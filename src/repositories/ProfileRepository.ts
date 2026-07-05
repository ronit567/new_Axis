import { SellerProfile } from '../types'
import { supabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { toSellerProfile } from './mappers'

export type UpsertProfileInput = {
  name: string
  program: string
  year: number | null
  bio: string
  verified: boolean
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
}
