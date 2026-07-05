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

// Cap search results so a broad query (no text, no filters) can't pull every
// active listing — and feed every id into the saved-ids IN() — in one request.
// A mobile search screen never renders more than a page at a time.
const SEARCH_RESULT_LIMIT = 50

// Postgres ILIKE treats \, %, and _ as pattern metacharacters. Escape them in
// user-supplied text before wrapping it in %...% so a search for "50%" or
// "intro_bio" matches literally instead of matching arbitrary characters.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// Build the PostgREST `or(...)` filter matching the text in EITHER title or
// description. Unlike the single-column `.ilike()` builder (which fully
// parameterizes its value), `.or()` embeds the value in PostgREST's own
// filter-string grammar — so on top of LIKE-escaping we double-quote the
// pattern and escape backslashes/quotes, otherwise a query containing a comma,
// period, parenthesis, or quote would break the parse or alter the filter.
function buildTextFilter(text: string): string {
  const pattern = `%${escapeLikePattern(text)}%`
  const quoted = `"${pattern.replace(/["\\]/g, (char) => `\\${char}`)}"`
  return `title.ilike.${quoted},description.ilike.${quoted}`
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
  // from the query rather than matched against a wildcard. Text matches the
  // title OR description (see buildTextFilter); results are capped and ordered
  // newest-first.
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

    if (trimmed) request = request.or(buildTextFilter(trimmed))
    if (filters.categories?.length) request = request.in('category', filters.categories)
    if (filters.priceMax != null) request = request.lte('price', filters.priceMax)
    if (filters.condition) request = request.eq('condition', filters.condition)

    const { data, error } = await request
      .order('created_at', { ascending: false })
      .limit(SEARCH_RESULT_LIMIT)
    if (error) throw error
    if (!data || data.length === 0) return []

    const rows = data as unknown as (ListingRow & { seller: ProfileRow })[]
    const savedIds = currentUserId
      ? await getSavedIds(currentUserId, rows.map((row) => row.id))
      : new Set<string>()

    return rows.map(({ seller, ...row }) => toListing(row, seller, savedIds.has(row.id)))
  },
}
