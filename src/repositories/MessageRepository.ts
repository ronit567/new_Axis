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
  listingId: string | null
  receiverId: string
  body: string
}

export type MessageEventHandlers = {
  onInsert: (message: Message) => void
  onUpdate: (message: Message) => void
}

export const MessageRepository = {
  // getConversations reads the conversation_list view (migration 0009): one
  // row per (listing, partner) thread — the thread's last message columns plus
  // its unread count, bucketed server-side under the caller's RLS. Partner and
  // listing hydration stays a client-side manual join, same style as
  // ListingRepository.getAll.
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
    // the thread renders without the listing banner.
    return rows.reduce<Conversation[]>((acc, row) => {
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
  // is exactly me<->partner about this listing even if policies loosen later.
  async getMessages(
    listingId: string | null,
    partnerId: string,
    userId: string,
  ): Promise<Message[]> {
    let query = supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
      )
      .order('created_at', { ascending: true })
    query = listingId === null ? query.is('listing_id', null) : query.eq('listing_id', listingId)

    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as MessageRow[]).map(toMessage)
  },

  async send(senderId: string, data: SendMessageInput): Promise<Message> {
    // Across a block the insert policy rejects the row — surfaces here as an
    // error for the UI to show, which is the intended behavior.
    const { data: row, error } = await supabase
      .from('messages')
      .insert({
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

  // Receiver-side read receipt: stamps every unread incoming message in the
  // thread. RLS + the column grant from migration 0008 keep this receiver-only
  // and read_at-only.
  async markConversationRead(
    listingId: string | null,
    partnerId: string,
    userId: string,
  ): Promise<void> {
    let query = supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', userId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
    query = listingId === null ? query.is('listing_id', null) : query.eq('listing_id', listingId)

    const { error } = await query
    if (error) throw error
  },

  // Realtime: stream INSERTs (new messages in both directions — including our
  // own sends echoing back from another device) and UPDATEs (read_at flips)
  // through the mapper. Deliberately no server-side filter: postgres_changes
  // respects RLS, so exactly the rows this user can select arrive. Returns the
  // unsubscribe fn.
  subscribeToMessages(userId: string, handlers: MessageEventHandlers): () => void {
    const channel = supabase
      .channel(`messages-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => handlers.onInsert(toMessage(payload.new as MessageRow)),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => handlers.onUpdate(toMessage(payload.new as MessageRow)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
