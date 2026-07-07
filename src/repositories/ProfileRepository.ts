import { SellerProfile } from '../types'
import { supabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { toSellerProfile } from './mappers'

// `verified` isn't accepted here on purpose — it's server-computed from the
// user's real email by a DB trigger (migration 0004), not client input. Both
// insert and update are protected by RLS's `auth.uid() = id` check (0002),
// but that alone doesn't stop a modified client from claiming a trust badge
// it hasn't earned.
export type UpsertProfileInput = {
  name: string
  program: string
  year: number | null
  bio: string
  initials?: string
  location?: string
  avatar_color?: string
}

// listings/sold stay 0 until AX-111 gives ProfileRepository real listing
// counts to aggregate (same deferral toSellerProfile already applies to
// rating/reviewCount pending AX-702).
function toProfile(row: ProfileRow): SellerProfile {
  return toSellerProfile(row, { listings: 0, sold: 0, replyTime: row.reply_time ?? '' })
}

export const ProfileRepository = {
  async getById(userId: string): Promise<SellerProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? toProfile(data) : null
  },
  async getCurrent(): Promise<SellerProfile | null> {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return null
    return ProfileRepository.getById(userId)
  },
  async upsert(userId: string, input: UpsertProfileInput): Promise<SellerProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...input }, { onConflict: 'id' })
      .select('*')
      .single()
    if (error) throw error
    return toProfile(data)
  },
  // Deletes the caller's auth.users row via the delete_own_account() RPC
  // (migration 0010) — see that migration for the cascade this triggers.
  // Irreversible; there is no undo path once this resolves.
  async deleteAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_own_account')
    if (error) throw error
  },
}
