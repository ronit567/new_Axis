import { supabase } from '../lib/supabase'
import { Listing } from '../types'

export type CreateListingInput = {
  title: string
  description: string
  price: number
  is_free: boolean
  is_trade: boolean
  condition: 'Like new' | 'Good' | 'Fair'
  category: string
  pickup: string
  image_urls: string[]
}

// Placeholder methods — real Supabase queries land in Phase 2. The shape here
// is the contract screens/hooks build against so nothing imports supabase directly.
export const ListingRepository = {
  async getAll(category?: string): Promise<Listing[]> {
    return []
  },
  async getById(id: string): Promise<Listing | null> {
    return null
  },
  async create(data: CreateListingInput): Promise<Listing> {
    throw new Error('ListingRepository.create not implemented')
  },
  async toggleSaved(listingId: string, userId: string): Promise<void> {},
  async getSavedByUser(userId: string): Promise<Listing[]> {
    return []
  },
}
