import { supabase } from '../lib/supabase'
import { toListing } from './mappers'
import { Listing, ListingCondition } from '../types'
import type { ListingRow, ProfileRow } from '../types/database'

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

export type GetAllListingsOptions = {
  category?: string
  limit?: number
  offset?: number
}

// rawCount is the number of rows the range() query actually returned, before
// any get dropped for a missing seller join. Pagination must key off this
// (not items.length) or a page with dropped rows looks short and
// getNextPageParam stops early even though more rows exist past the range.
export type ListingsPage = {
  items: Listing[]
  rawCount: number
}

// AX-201: one page of the home feed. Kept in sync with useListings' getNextPageParam.
export const LISTINGS_PAGE_SIZE = 20

export type ListingSearchFilters = {
  categories?: string[]
  priceMax?: number
  condition?: ListingCondition
}

export type SearchOptions = {
  limit?: number
  offset?: number
}

// One page of search results — offset-paginated the same way as the home
// feed, so a broad query (no text, no filters) loads a bounded page instead
// of pulling every active listing (and feeding every id into the saved-ids
// IN()) in one request. Kept in sync with useSearchListings' getNextPageParam.
export const SEARCH_PAGE_SIZE = 20

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

// getAll (AX-201) and search (AX-204) are real; getById/create/getSavedByUser
// stay placeholders until their tickets (AX-203, AX-202, AX-302) land. The
// shape here is the contract screens/hooks build against so nothing imports
// supabase directly.
export const ListingRepository = {
  async getAll(userId: string, options: GetAllListingsOptions = {}): Promise<ListingsPage> {
    const { category, limit = LISTINGS_PAGE_SIZE, offset = 0 } = options

    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: rows, error } = await query
    if (error) throw error
    if (!rows || rows.length === 0) return { items: [], rawCount: 0 }

    const sellerIds = [...new Set(rows.map((row) => row.seller_id))]
    const [{ data: sellers, error: sellersError }, { data: savedRows, error: savedError }] =
      await Promise.all([
        supabase.from('profiles').select('*').in('id', sellerIds),
        supabase
          .from('saved_listings')
          .select('listing_id')
          .eq('user_id', userId)
          .in(
            'listing_id',
            rows.map((row) => row.id),
          ),
      ])
    if (sellersError) throw sellersError
    if (savedError) throw savedError

    const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]))
    const savedIds = new Set((savedRows ?? []).map((row) => row.listing_id))

    // seller_id is a NOT NULL FK, so a missing seller would mean a broken
    // reference — skip rather than crash the whole feed over one bad row.
    // rawCount still reflects rows.length so pagination isn't thrown off by it.
    const items = rows.reduce<Listing[]>((acc, row) => {
      const seller = sellerById.get(row.seller_id)
      if (seller) acc.push(toListing(row, seller, savedIds.has(row.id)))
      return acc
    }, [])

    return { items, rawCount: rows.length }
  },
  async getById(id: string): Promise<Listing | null> {
    return null
  },
  async create(sellerId: string, data: CreateListingInput): Promise<Listing> {
    throw new Error('ListingRepository.create not implemented')
  },
  // AX-201 follow-up: real toggle. Try deleting the save first; if a row was
  // actually removed we're done (now unsaved), otherwise insert it (now saved).
  // One round trip in the common case instead of a separate exists-check.
  async toggleSaved(listingId: string, userId: string): Promise<void> {
    const { data: deleted, error: deleteError } = await supabase
      .from('saved_listings')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .select('listing_id')
    if (deleteError) throw deleteError
    if (deleted && deleted.length > 0) return

    const { error: insertError } = await supabase
      .from('saved_listings')
      .insert({ user_id: userId, listing_id: listingId })
    if (insertError) throw insertError
  },
  async getSavedByUser(userId: string): Promise<Listing[]> {
    return []
  },
  // Server-side text/category/price/condition search (AX-204). All filters
  // are optional and combine with AND — an unset filter is simply omitted
  // from the query rather than matched against a wildcard. Text matches the
  // title OR description (see buildTextFilter); results are offset-paginated
  // and ordered newest-first, same shape as getAll.
  async search(
    query: string,
    filters: ListingSearchFilters = {},
    currentUserId?: string,
    options: SearchOptions = {},
  ): Promise<ListingsPage> {
    const { limit = SEARCH_PAGE_SIZE, offset = 0 } = options
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
      .range(offset, offset + limit - 1)
    if (error) throw error
    if (!data || data.length === 0) return { items: [], rawCount: 0 }

    const rows = data as unknown as (ListingRow & { seller: ProfileRow })[]
    const savedIds = currentUserId
      ? await getSavedIds(currentUserId, rows.map((row) => row.id))
      : new Set<string>()

    const items = rows.map(({ seller, ...row }) => toListing(row, seller, savedIds.has(row.id)))
    return { items, rawCount: rows.length }
  },
}
