import { supabase } from '../lib/supabase'

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
}
