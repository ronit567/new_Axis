import { supabase } from '../lib/supabase'
import { toBlockedUser } from './mappers'
import type { BlockedUser } from '../types'

export const BlockRepository = {
  // Idempotent: re-blocking an already-blocked user (e.g. a double-tap) is a
  // no-op rather than a duplicate-key error — blocks' PK is
  // (blocker_id, blocked_id). Once this row exists, is_blocked() (0002)
  // takes over and hides the blocked user's listings/profile from the
  // blocker (and vice versa) at the RLS layer — this is just the write.
  async create(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await supabase
      .from('blocks')
      .upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      )
    if (error) throw error
  },

  // The caller's own blocks, newest first, with display info. Goes through the
  // my_blocked_users() RPC (0033) rather than a blocks→profiles join because
  // profiles RLS hides profiles across a block in both directions — a client
  // join would return rows with no names.
  async listBlocked(): Promise<BlockedUser[]> {
    const { data, error } = await supabase.rpc('my_blocked_users')
    if (error) throw error
    return (data ?? []).map(toBlockedUser)
  },

  // Removing the row un-hides both sides again (is_blocked() finds nothing).
  // blocks_delete_own (0002) pins the delete to the caller's own outgoing
  // blocks, so blockerId beyond auth.uid() can't reach anyone else's rows.
  async remove(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
    if (error) throw error
  },
}
