import { supabase } from '../lib/supabase'
import { toConversation, toMessage } from './mappers'
import type { Conversation, Message } from '../types'
import type { ListingRow, MessageRow, ProfileRow } from '../types/database'

export type SendMessageInput = {
  listingId: string | null
  receiverId: string
  body: string
}

// getConversations reduces the caller's recent messages client-side (same
// manual-join style as ListingRepository.getAll — no SQL views/RPCs yet).
// The scan window bounds that fetch; conversations whose *entire* history is
// older than the newest N messages fall off the inbox. 400 ≈ months of student
// marketplace traffic; revisit with an RPC if inboxes outgrow it.
export const CONVERSATIONS_SCAN_LIMIT = 400

type ConversationBucket = {
  last: MessageRow
  partnerId: string
  unread: number
}

export const MessageRepository = {
  async getConversations(userId: string): Promise<Conversation[]> {
    const { data: rows, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(CONVERSATIONS_SCAN_LIMIT)
    if (error) throw error
    if (!rows || rows.length === 0) return []

    // Newest-first scan: the first row seen for a (listing, partner) pair is
    // that conversation's last message; later rows only bump its unread count.
    // Map insertion order therefore *is* last-message-desc order.
    const buckets = new Map<string, ConversationBucket>()
    for (const row of rows as MessageRow[]) {
      const partnerId = row.sender_id === userId ? row.receiver_id : row.sender_id
      const key = `${row.listing_id ?? 'none'}|${partnerId}`
      const isUnreadIncoming = row.receiver_id === userId && row.read_at === null
      const bucket = buckets.get(key)
      if (!bucket) {
        buckets.set(key, { last: row, partnerId, unread: isUnreadIncoming ? 1 : 0 })
      } else if (isUnreadIncoming) {
        bucket.unread += 1
      }
    }

    const conversations = [...buckets.values()]
    const partnerIds = [...new Set(conversations.map((b) => b.partnerId))]
    const listingIds = [
      ...new Set(
        conversations
          .map((b) => b.last.listing_id)
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
    return conversations.reduce<Conversation[]>((acc, bucket) => {
      const partner = partnerById.get(bucket.partnerId)
      if (!partner) return acc
      acc.push(
        toConversation({
          partner,
          listing: bucket.last.listing_id
            ? listingById.get(bucket.last.listing_id) ?? null
            : null,
          lastMessage: bucket.last,
          unreadCount: bucket.unread,
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
  // thread. RLS + the column grant from migration 0005 keep this receiver-only
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

  // Realtime: push each INSERT addressed to this user through the mapper and
  // hand the domain Message to the caller. postgres_changes respects RLS, so
  // only rows the subscriber can select arrive. Returns the unsubscribe fn.
  subscribeToIncoming(userId: string, onMessage: (message: Message) => void): () => void {
    const channel = supabase
      .channel(`messages-incoming-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => onMessage(toMessage(payload.new as MessageRow)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
