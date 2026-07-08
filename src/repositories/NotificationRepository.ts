import { supabase } from '../lib/supabase'
import { toNotification } from './mappers'
import type { Notification } from '../types'
import type { ListingRow, NotificationRow, ProfileRow } from '../types/database'

export type NotificationEventHandlers = {
  onInsert: (row: NotificationRow) => void
  onUpdate: (row: NotificationRow) => void
}

export const NotificationRepository = {
  // Newest-first, capped at `limit`. Batch-joins actor profiles and listings
  // (same manual-join shape as MessageRepository.getConversations) rather than
  // a PostgREST embed, so the mapper stays DB-shape agnostic.
  async list(userId: string, limit = 30): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    const rows = (data ?? []) as NotificationRow[]
    if (rows.length === 0) return []

    const actorIds = [
      ...new Set(
        rows.map((row) => row.actor_id).filter((id): id is string => id !== null),
      ),
    ]
    const listingIds = [
      ...new Set(
        rows.map((row) => row.listing_id).filter((id): id is string => id !== null),
      ),
    ]

    const [actorsResult, listingsResult] = await Promise.all([
      supabase.from('profiles').select('*').in('id', actorIds),
      listingIds.length > 0
        ? supabase.from('listings').select('*').in('id', listingIds)
        : Promise.resolve({ data: [] as ListingRow[], error: null }),
    ])
    if (actorsResult.error) throw actorsResult.error
    if (listingsResult.error) throw listingsResult.error

    const actorById = new Map(
      ((actorsResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    )
    const listingById = new Map(
      ((listingsResult.data ?? []) as ListingRow[]).map((l) => [l.id, l]),
    )

    // A missing actor profile means they're RLS-hidden (blocked in either
    // direction) — drop the notification, same convention as
    // MessageRepository.getConversations dropping a thread whose partner
    // profile is missing.
    return rows.reduce<Notification[]>((acc, row) => {
      const actor = row.actor_id ? actorById.get(row.actor_id) : undefined
      if (row.actor_id && !actor) return acc
      acc.push(
        toNotification({
          row,
          actor: actor ?? null,
          listing: row.listing_id ? listingById.get(row.listing_id) ?? null : null,
        }),
      )
      return acc
    }, [])
  },

  async unreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    if (error) throw error
    return count ?? 0
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)
    if (error) throw error
  },

  // Dev/test helper (0016): asks the DB to insert a canned notification for
  // the current user, exercising the full pipeline (insert → realtime → bell).
  async createTest(): Promise<void> {
    const { error } = await supabase.rpc('create_test_notification')
    if (error) throw error
  },

  // Realtime: stream INSERTs (new notifications from the 0012 triggers) and
  // UPDATEs (read flips, e.g. from another device). Handlers get the raw row —
  // consumers only invalidate caches, and the domain mapping needs the
  // actor/listing joins that list() does anyway. Filtered to this user's rows
  // (RLS enforces the same bound; the filter keeps the channel from waking on
  // other users' events). Returns the unsubscribe fn.
  subscribe(userId: string, handlers: NotificationEventHandlers): () => void {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => handlers.onInsert(payload.new as NotificationRow),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => handlers.onUpdate(payload.new as NotificationRow),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
