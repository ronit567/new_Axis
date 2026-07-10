import { supabase } from '../lib/supabase'
import type { SellerProfile } from '../types'
import type { FollowRow, ProfileRow } from '../types/database'
import { toSellerProfile } from './mappers'

export const FollowRepository = {
  // Who the current user follows, most recently followed first. Returns full
  // SellerProfiles (zero stats — same deferral as ProfileRepository.toProfile)
  // so the Saved screen's profiles tab can hand a row straight to the
  // SellerProfile route.
  // Batch-joins profiles manually (NotificationRepository shape); a profile
  // missing from the join is RLS-hidden (blocked since the follow) and its
  // follow is dropped from the list rather than rendered blank.
  async listFollowing(userId: string): Promise<SellerProfile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as FollowRow[]
    if (rows.length === 0) return []

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', rows.map((row) => row.followee_id))
    if (profilesError) throw profilesError
    const profileById = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    )

    return rows.reduce<SellerProfile[]>((acc, row) => {
      const profile = profileById.get(row.followee_id)
      if (profile) {
        acc.push(
          toSellerProfile(profile, {
            listings: 0,
            sold: 0,
            replyTime: profile.reply_time ?? '',
          }),
        )
      }
      return acc
    }, [])
  },

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId)
    if (error) throw error
    return (count ?? 0) > 0
  },

  // Idempotent, same upsert shape as BlockRepository.create: a double-tap
  // re-follow is a no-op, not a duplicate-key error.
  async follow(followerId: string, followeeId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .upsert(
        { follower_id: followerId, followee_id: followeeId },
        { onConflict: 'follower_id,followee_id', ignoreDuplicates: true },
      )
    if (error) throw error
  },

  async unfollow(followerId: string, followeeId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId)
    if (error) throw error
  },
}
