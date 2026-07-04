import { Listing } from '../types'
import type { ListingCondition, ListingRow, ProfileRow } from '../types/database'
import { supabase } from '../lib/supabase'
import { toListing } from './mappers'

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

export type ListingSearchFilters = {
  categories?: string[]
  priceMax?: number
  condition?: ListingCondition
}

// listing_id set the current user has saved, scoped to the given ids so the
// IN() stays bounded to one page of search results instead of the user's
// whole saved-listings history.
async function getSavedIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('saved_listings')
    .select('listing_id')
    .eq('user_id', userId)
    .in('listing_id', listingIds)
  if (error) throw error

  return new Set((data ?? []).map((row) => row.listing_id))
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
  async create(sellerId: string, data: CreateListingInput): Promise<Listing> {
    throw new Error('ListingRepository.create not implemented')
  },
  async toggleSaved(listingId: string, userId: string): Promise<void> {},
  async getSavedByUser(userId: string): Promise<Listing[]> {
    return []
  },
  // Server-side text/category/price/condition search (AX-204). All filters
  // are optional and combine with AND — an unset filter is simply omitted
  // from the query rather than matched against a wildcard.
  async search(
    query: string,
    filters: ListingSearchFilters = {},
    currentUserId?: string,
  ): Promise<Listing[]> {
    const trimmed = query.trim()

    let request = supabase
      .from('listings')
      .select('*, seller:profiles!listings_seller_id_fkey(*)')
      .eq('status', 'active')

    if (trimmed) request = request.ilike('title', `%${trimmed}%`)
    if (filters.categories?.length) request = request.in('category', filters.categories)
    if (filters.priceMax != null) request = request.lte('price', filters.priceMax)
    if (filters.condition) request = request.eq('condition', filters.condition)

    const { data, error } = await request.order('created_at', { ascending: false })
    if (error) throw error
    if (!data || data.length === 0) return []

    const rows = data as unknown as (ListingRow & { seller: ProfileRow })[]
    const savedIds = currentUserId
      ? await getSavedIds(currentUserId, rows.map((row) => row.id))
      : new Set<string>()

    return rows.map(({ seller, ...row }) => toListing(row, seller, savedIds.has(row.id)))
  },
}
