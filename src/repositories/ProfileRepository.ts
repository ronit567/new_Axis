import { supabase } from '../lib/supabase'
import { SellerProfile } from '../types'

export type UpsertProfileInput = {
  name: string
  initials: string
  program: string
  year: number
  location: string
  avatar_color: string
}

// Placeholder methods — real Supabase queries land in Phase 2 once the
// `profiles` table + RLS exist.
export const ProfileRepository = {
  async getById(userId: string): Promise<SellerProfile | null> {
    return null
  },
  async getCurrent(): Promise<SellerProfile | null> {
    return null
  },
  async upsert(userId: string, data: UpsertProfileInput): Promise<SellerProfile> {
    throw new Error('ProfileRepository.upsert not implemented')
  },
}
