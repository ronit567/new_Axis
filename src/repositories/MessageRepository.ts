import { supabase } from '../lib/supabase'
import { resubscribeDetector } from './realtimeStatus'
import {
  CONTACT_COLUMNS,
  LISTING_THUMB_COLUMNS,
  toConversation,
  toMessage,
  type ContactRow,
  type ListingThumbRow,
} from './mappers'
import type { Conversation, Message } from '../types'
import type { ConversationListRow, MessageRow } from '../types/database'

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
  // The channel re-joined after a drop: events may have been missed.
  onResubscribed?: () => void
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
  // listing again in 0051): one row per (listing, partner) thread — that
  // thread's newest message columns plus its own unread count, bucketed
  // server-side under the caller's RLS. Partner and listing hydration stays a
  // client-side manual join, same style as ListingRepository.getAll.
  //
  // A thread's listing is its subject, so the listing hydration is no longer
  // decoration: it supplies the title and thumbnail MessagesScreen labels the
  // row with.
  //
  // `signal` aborts all three requests. The inbox is rebuilt in response to
  // events, so a rebuild is often superseded while still in flight; without the
  // signal the abandoned one still runs to completion on the server.
  async getConversations(userId: string, signal?: AbortSignal): Promise<Conversation[]> {
    const listQuery = supabase
      .from('conversation_list')
      .select('*')
      .order('created_at', { ascending: false })
    const { data, error } = await (signal ? listQuery.abortSignal(signal) : listQuery)
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

    // Built only when needed: `.in('id', [])` is a malformed PostgREST filter,
    // not an empty result.
    const fetchPartners = () => {
      const query = supabase.from('profiles').select(CONTACT_COLUMNS).in('id', partnerIds)
      return signal ? query.abortSignal(signal) : query
    }
    const fetchListings = () => {
      const query = supabase.from('listings').select(LISTING_THUMB_COLUMNS).in('id', listingIds)
      return signal ? query.abortSignal(signal) : query
    }
    const [partnersResult, listingsResult] = await Promise.all([
      fetchPartners(),
      listingIds.length > 0
        ? fetchListings()
        : Promise.resolve({ data: [] as ListingThumbRow[], error: null }),
    ])
    if (partnersResult.error) throw partnersResult.error
    if (listingsResult.error) throw listingsResult.error

    const partnerById = new Map(
      ((partnersResult.data ?? []) as ContactRow[]).map((p) => [p.id, p]),
    )
    const listingById = new Map(
      ((listingsResult.data ?? []) as ListingThumbRow[]).map((l) => [l.id, l]),
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
  // (listing, person) pair (0051): only the messages about THIS listing, so
  // asking the same seller about two things reads as two conversations.
  //
  // listingId === null is its own thread, not "any listing": it is the bucket
  // conversation_list groups null listing_ids into — a chat opened without
  // listing context, or one whose listing was deleted and nulled by 0051's FK.
  // It therefore filters with `.is('listing_id', null)`, never with no filter
  // at all, which would pull every listing's messages into that one thread.
  //
  // Capped to the newest MESSAGE_PAGE_LIMIT rows (fetched newest-first, then
  // reversed back to ascending for the chat view) so an unusually long thread
  // can't grow the query without bound. Older history is simply not loaded;
  // cursor pagination is deliberately deferred until a real thread hits the
  // cap — the flat Message[] cache shape must stay untouched because realtime
  // dedup, optimistic sends, and read receipts all setQueryData against it.
  async getMessages(
    partnerId: string,
    userId: string,
    listingId: string | null,
  ): Promise<Message[]> {
    assertUuid(userId, 'userId')
    assertUuid(partnerId, 'partnerId')
    // listingId needs no such check: it reaches PostgREST through `.eq()`,
    // which is parameterized, not through the `.or()` grammar above.
    const query = supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
      )
    const scoped =
      listingId === null ? query.is('listing_id', null) : query.eq('listing_id', listingId)

    // A thread the user deleted (0052) comes back when the other person
    // replies, but it comes back as a new conversation — the messages they
    // cleared stay cleared. Without this the reply would drag the whole
    // history back onto the screen, which is not what "delete" means anywhere
    // else. Fetched alongside the messages rather than before them so the
    // extra round trip costs no latency.
    const hiddenAt = await MessageRepository.getConversationHiddenAt(partnerId, listingId)
    const visible = hiddenAt === null ? scoped : scoped.gt('created_at', hiddenAt)

    const { data, error } = await visible
      // id tiebreak: rapid sends can share a created_at, and Postgres
      // guarantees nothing within equal sort keys — without it both the
      // cap boundary and the rendered order can shift between refetches.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MESSAGE_PAGE_LIMIT)
    if (error) throw error
    return ((data ?? []) as MessageRow[]).map(toMessage).reverse()
  },

  /**
   * When the calling user last deleted this thread, or null if they have not.
   *
   * RLS (0052) scopes conversation_hides to the caller, so no user id is
   * needed here and one cannot be spoofed by a modified client.
   */
  async getConversationHiddenAt(
    partnerId: string,
    listingId: string | null,
  ): Promise<string | null> {
    assertUuid(partnerId, 'partnerId')
    const query = supabase
      .from('conversation_hides')
      .select('hidden_at')
      .eq('partner_id', partnerId)
    const scoped =
      listingId === null ? query.is('listing_id', null) : query.eq('listing_id', listingId)
    // maybeSingle, not single: "never hidden" is the common case and is not an
    // error.
    const { data, error } = await scoped.maybeSingle()
    if (error) throw error
    return data?.hidden_at ?? null
  },

  /**
   * Delete a conversation for this user only.
   *
   * Nothing is removed from public.messages: the other participant keeps the
   * thread in full, and a moderator reading a report still sees it. See the
   * header of 0052 for why that is not negotiable.
   *
   * Deleting a thread that was already deleted moves the mark forward, which
   * is what clears messages received since the last delete.
   */
  async hideConversation(
    userId: string,
    partnerId: string,
    listingId: string | null,
  ): Promise<void> {
    assertUuid(userId, 'userId')
    assertUuid(partnerId, 'partnerId')
    // onConflict names the unique constraint's columns so a second delete
    // updates hidden_at instead of failing. The constraint is NULLS NOT
    // DISTINCT, so the listing-less bucket has exactly one row to update.
    const { error } = await supabase.from('conversation_hides').upsert(
      {
        user_id: userId,
        partner_id: partnerId,
        listing_id: listingId,
        hidden_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,partner_id,listing_id' },
    )
    if (error) throw error
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
    if (error) {
      // 23505 on the primary key: a row with this client-generated id already
      // exists, which can only be an earlier attempt at this same send whose
      // response never arrived (the request timed out after the insert
      // committed). The message was sent; report it as such instead of failing
      // a second time — ChatScreen reuses the id when the same text is re-sent.
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('messages')
          .select('*')
          .eq('id', data.id)
          .eq('sender_id', senderId)
          .maybeSingle()
        if (existing) return toMessage(existing as MessageRow)
      }
      throw error
    }
    return toMessage(row as MessageRow)
  },

  // Receiver-side read receipt: stamps every unread incoming message in THIS
  // thread — this partner, this listing (0051). Scoped to the listing for the
  // same reason the inbox is: opening the chat about the desk lamp must not
  // clear the unread badge on the chat about the textbook. RLS + the
  // column grant from migration 0008 keep this receiver-only and read_at-only.
  async markConversationRead(
    partnerId: string,
    userId: string,
    listingId: string | null,
  ): Promise<void> {
    const query = supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', userId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
    const { error } = await (listingId === null
      ? query.is('listing_id', null)
      : query.eq('listing_id', listingId))
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
      .subscribe(resubscribeDetector(handlers.onResubscribed))
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
