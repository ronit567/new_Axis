import { supabase } from '../lib/supabase'
import { toListing, toMyListing } from './mappers'
import { Listing, MyListing } from '../types'

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

// The shape here is the contract screens/hooks build against so nothing
// imports supabase directly.
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
  // AX-501: detail view fetches fresh from the DB (not the possibly-stale
  // object a list screen navigated with) so a listing deleted after being
  // saved/messaged-about resolves to null instead of showing ghost data.
  // No `status` filter here (unlike getAll) — sold listings must still open.
  async getById(id: string, userId: string): Promise<Listing | null> {
    const { data: row, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!row) return null

    const [{ data: seller, error: sellerError }, { data: savedRow, error: savedError }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', row.seller_id).maybeSingle(),
        supabase
          .from('saved_listings')
          .select('listing_id')
          .eq('user_id', userId)
          .eq('listing_id', row.id)
          .maybeSingle(),
      ])
    if (sellerError) throw sellerError
    if (savedError) throw savedError

    // seller_id is a NOT NULL FK, so a missing seller means a broken
    // reference — treat the listing as unavailable rather than rendering it
    // with no seller info (mirrors the skip-on-missing-seller rule in getAll).
    if (!seller) return null

    return toListing(row, seller, !!savedRow)
  },
  // AX-302/AX-401: listingId is caller-generated (see useCreateListing) so images
  // can be uploaded to their final path *before* this insert runs — this call only
  // ever persists image_urls that are already live in storage.
  async create(sellerId: string, listingId: string, data: CreateListingInput): Promise<Listing> {
    const { data: row, error } = await supabase
      .from('listings')
      .insert({ id: listingId, seller_id: sellerId, ...data })
      .select('*')
      .single()
    if (error) throw error

    const { data: sellerRow, error: sellerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sellerId)
      .single()
    if (sellerError) throw sellerError

    // A listing can't already be saved by anyone the instant it's created.
    return toListing(row, sellerRow, false)
  },
  // ManageListingsScreen's own-listings view (all statuses, not just active).
  async getBySeller(sellerId: string): Promise<MyListing[]> {
    const { data: rows, error } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    if (!rows || rows.length === 0) return []

    // saved_select_own (0002) scopes saved_listings select to the caller's own
    // rows, so querying the table directly here would only ever see whether
    // *this* signed-in user saved their own listing — never the real count
    // across everyone. my_listing_save_counts() (0006) is a SECURITY DEFINER
    // RPC scoped to the caller's own listings that aggregates across users.
    const { data: saveCounts, error: savesError } = await supabase.rpc('my_listing_save_counts')
    if (savesError) throw savesError

    const savesByListing = new Map(
      (saveCounts ?? []).map(({ listing_id, saves }) => [listing_id, saves]),
    )

    return rows.map((row) => toMyListing(row, savesByListing.get(row.id) ?? 0))
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
  // AX-202: saved listings, most-recently-saved first. Two round trips (saved
  // ids, then the listings/sellers themselves) since saved_listings has no
  // listing columns of its own to select alongside.
  async getSavedByUser(userId: string): Promise<Listing[]> {
    const { data: savedRows, error: savedError } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (savedError) throw savedError
    if (!savedRows || savedRows.length === 0) return []

    const listingIds = savedRows.map((row) => row.listing_id)
    // Match getAll's active-only filter: there's no "sold"/"unavailable" badge
    // in the UI yet, so a sold listing would look identical to a live one in
    // the Saved list — excluding it here avoids a misleading duplicate-looking
    // entry. Revisit once a status badge exists (users may want to see that a
    // saved item sold rather than have it silently disappear).
    const { data: rows, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .in('id', listingIds)
    if (listingsError) throw listingsError
    if (!rows || rows.length === 0) return []

    const sellerIds = [...new Set(rows.map((row) => row.seller_id))]
    const { data: sellers, error: sellersError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', sellerIds)
    if (sellersError) throw sellersError

    const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]))
    const rowById = new Map(rows.map((row) => [row.id, row]))

    // Walk listingIds (already ordered by save recency) rather than rows, so
    // the result preserves save order instead of the `in (...)` query's order.
    // seller_id is a NOT NULL FK, so a missing seller means a broken
    // reference — skip rather than crash the whole list over one bad row.
    return listingIds.reduce<Listing[]>((acc, id) => {
      const row = rowById.get(id)
      const seller = row && sellerById.get(row.seller_id)
      if (row && seller) acc.push(toListing(row, seller, true))
      return acc
    }, [])
  },
}
