import { supabase } from '../lib/supabase'
import { toConversation, toMessage } from './mappers'
import type { Conversation, Message } from '../types'
import type {
  ConversationListRow,
  ListingRow,
  MessageRow,
  ProfileRow,
} from '../types/database'

export type SendMessageInput = {
  // Client-generated UUID (the row's actual id). The optimistic cache entry,
  // the realtime echo, and the mutation result all carry the same id, so every
  // reconciliation path keys on it — no temp-id/body matching heuristics.
  id: string
  listingId: string | null
  receiverId: string
  body: string
}

export type MessageEventHandlers = {
  onInsert: (message: Message) => void
  onUpdate: (message: Message) => void
}

// Newest messages a thread loads in one fetch (see getMessages). Generous for
// a two-person conversation about one listing; exported so a future cursor
// implementation and tests key off the same number.
export const MESSAGE_PAGE_LIMIT = 200

// getMessages embeds these ids into PostgREST's `.or()` filter grammar, which —
// unlike `.eq()`/`.insert()`/`.update()` — is not parameterized: a value
// carrying `,`, `(`, or `)` could restructure the filter. partnerId in
// particular arrives via navigation route params (deep-linkable). Both are
// always profile UUIDs, so we reject anything that isn't one before it reaches
// the filter string rather than trying to escape the grammar.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`MessageRepository: ${label} must be a UUID`)
  }
}

// Monotonic per-session suffix for realtime channel topics. supabase.channel()
// reuses an existing channel whenever one with the same topic is still
// registered, and removeChannel() only tears the old one out of the client's
// channel list after an async unsubscribe round-trip resolves. So a remount
// that re-subscribes before that teardown lands would reuse the still-joined
// channel and call `.on('postgres_changes', …)` on it — which throws
// "cannot add postgres_changes callbacks … after subscribe()". A unique topic
// per subscription guarantees a fresh channel every time and sidesteps the race.
let channelSeq = 0

export const MessageRepository = {
  // getConversations reads the conversation_list view (0009, regrouped per
  // partner in 0026): one row per person — that person's newest message
  // columns (whose listing_id supplies the row's listing context) plus the
  // unread count across all their messages, bucketed server-side under the
  // caller's RLS. Partner and listing hydration stays a client-side manual
  // join, same style as ListingRepository.getAll.
  async getConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversation_list')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as ConversationListRow[]
    if (rows.length === 0) return []

    const partnerIds = [...new Set(rows.map((row) => row.partner_id))]
    const listingIds = [
      ...new Set(
        rows
          .map((row) => row.listing_id)
          .filter((id): id is string => id !== null),
      ),
    ]

    const [partnersResult, listingsResult] = await Promise.all([
      supabase.from('profiles').select('*').in('id', partnerIds),
      listingIds.length > 0
        ? supabase.from('listings').select('*').in('id', listingIds)
        : Promise.resolve({ data: [] as ListingRow[], error: null }),
    ])
    if (partnersResult.error) throw partnersResult.error
    if (listingsResult.error) throw listingsResult.error

    const partnerById = new Map(
      ((partnersResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    )
    const listingById = new Map(
      ((listingsResult.data ?? []) as ListingRow[]).map((l) => [l.id, l]),
    )

    // A missing partner profile means the counterpart is RLS-hidden (blocked in
    // either direction) — drop the whole thread from the inbox, per AX-703's
    // "filter blocked users out of messages". A missing listing row is fine:
    // the thread renders without the listing banner. A self-thread (partner is
    // the caller — possible only via rows that predate messages_no_self, 0025)
    // is dropped too so it can't be reopened from the inbox.
    return rows.reduce<Conversation[]>((acc, row) => {
      if (row.partner_id === userId) return acc
      const partner = partnerById.get(row.partner_id)
      if (!partner) return acc
      acc.push(
        toConversation({
          partner,
          listing: row.listing_id ? listingById.get(row.listing_id) ?? null : null,
          lastMessage: row,
          unreadCount: row.unread_count,
          currentUserId: userId,
        }),
      )
      return acc
    }, [])
  },

  // The two directions are filtered explicitly (not left to RLS) so the thread
  // is exactly me<->partner even if policies loosen later. The thread is the
  // person (0026): every message with this partner, regardless of which
  // listing each one was about — listing_id stays on the individual messages
  // as per-message context.
  //
  // Capped to the newest MESSAGE_PAGE_LIMIT rows (fetched newest-first, then
  // reversed back to ascending for the chat view) so an unusually long thread
  // can't grow the query without bound. Older history is simply not loaded;
  // cursor pagination is deliberately deferred until a real thread hits the
  // cap — the flat Message[] cache shape must stay untouched because realtime
  // dedup, optimistic sends, and read receipts all setQueryData against it.
  async getMessages(partnerId: string, userId: string): Promise<Message[]> {
    assertUuid(userId, 'userId')
    assertUuid(partnerId, 'partnerId')
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
      )
      // id tiebreak: rapid sends can share a created_at, and Postgres
      // guarantees nothing within equal sort keys — without it both the
      // cap boundary and the rendered order can shift between refetches.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MESSAGE_PAGE_LIMIT)
    if (error) throw error
    return ((data ?? []) as MessageRow[]).map(toMessage).reverse()
  },

  // Mirrors the reviews_insert_reviewer policy gate (0020): a review can only
  // be written by someone who has an existing message with the seller, in
  // either direction. Used to decide whether to even show the review UI.
  async hasChattedWith(userId: string, partnerId: string): Promise<boolean> {
    assertUuid(userId, 'userId')
    assertUuid(partnerId, 'partnerId')
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
      )
      .limit(1)
    if (error) throw error
    return (data ?? []).length > 0
  },

  async send(senderId: string, data: SendMessageInput): Promise<Message> {
    // Screens hide the message actions on your own listing, but a deep link or
    // stale route params can still target yourself — reject before the insert
    // (the DB's messages_no_self constraint + insert policy are the backstop).
    if (senderId === data.receiverId) {
      throw new Error('MessageRepository: cannot send a message to yourself')
    }
    // Across a block the insert policy rejects the row — surfaces here as an
    // error for the UI to show, which is the intended behavior.
    const { data: row, error } = await supabase
      .from('messages')
      .insert({
        id: data.id,
        listing_id: data.listingId,
        sender_id: senderId,
        receiver_id: data.receiverId,
        body: data.body,
      })
      .select('*')
      .single()
    if (error) throw error
    return toMessage(row as MessageRow)
  },

  // Receiver-side read receipt: stamps every unread incoming message from this
  // partner (the whole per-person thread, 0025). RLS + the column grant from
  // migration 0008 keep this receiver-only and read_at-only.
  async markConversationRead(partnerId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', userId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
    if (error) throw error
  },

  // Realtime: stream INSERTs (new messages in both directions — including our
  // own sends echoing back from another device) and UPDATEs (read_at flips)
  // through the mapper. Returns the unsubscribe fn.
  //
  // Four bindings, not two. RLS alone would deliver the right rows with no
  // filter at all, but an unfiltered binding makes Realtime evaluate every
  // messages change against EVERY connected subscriber's RLS before deciding
  // who gets it — work that scales with (subscribers x message rate) on one
  // service. Filtering server-side eliminates non-participants before that
  // check, so a message costs two RLS evaluations rather than N.
  //
  // postgres_changes filters cannot express OR, and a participant is either
  // the sender or the receiver, so each event needs one binding per side.
  //
  // The two sides cannot both match the same row: migration 0025 adds
  // `check (sender_id <> receiver_id)`, so no message is ever from and to the
  // same person and no handler fires twice for one row. (onInsert dedups by id
  // regardless — see useMessages — but the constraint is why that safety net
  // is never load-bearing here.)
  //
  // NOTE ON THE FAILURE MODE: a wrong filter here does not error or duplicate,
  // it silently drops messages for whichever case it fails to match. Verify
  // against a real second device — both directions, plus read receipts for the
  // UPDATE bindings — not just a green test run.
  subscribeToMessages(userId: string, handlers: MessageEventHandlers): () => void {
    const onInsert = (payload: { new: unknown }) =>
      handlers.onInsert(toMessage(payload.new as MessageRow))
    const onUpdate = (payload: { new: unknown }) =>
      handlers.onUpdate(toMessage(payload.new as MessageRow))

    const channel = supabase
      .channel(`messages-${userId}-${channelSeq++}`)
      // Messages sent TO this user.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        onInsert,
      )
      // Messages sent BY this user — the echo that keeps a second device's
      // thread in sync with a send made on the first.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        onInsert,
      )
      // read_at flipping on a message this user received (they opened the
      // thread on another device).
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        onUpdate,
      )
      // read_at flipping on a message this user SENT — the partner read it.
      // This is the binding that drives read receipts; dropping it would leave
      // sent messages showing as unread forever.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        onUpdate,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
