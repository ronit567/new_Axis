import { supabase } from '../lib/supabase'
import { toListing } from './mappers'
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
    const { data: row, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!row) return null

    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', row.seller_id)
      .maybeSingle()
    if (sellerError) throw sellerError
    if (!seller) return null

    // No userId param on this method (callers only have the listing id), so
    // resolve the viewer from the session to compute their own saved status.
    const { data: sessionData } = await supabase.auth.getSession()
    const viewerId = sessionData.session?.user.id
    let isSaved = false
    if (viewerId) {
      const { data: savedRow, error: savedError } = await supabase
        .from('saved_listings')
        .select('listing_id')
        .eq('user_id', viewerId)
        .eq('listing_id', id)
        .maybeSingle()
      if (savedError) throw savedError
      isSaved = !!savedRow
    }

    return toListing(row, seller, isSaved)
  },
  async create(sellerId: string, data: CreateListingInput): Promise<Listing> {
    const { data: row, error } = await supabase
      .from('listings')
      .insert({ seller_id: sellerId, ...data })
      .select('*')
      .single()
    if (error) throw error

    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sellerId)
      .single()
    if (sellerError) throw sellerError

    return toListing(row, seller, false)
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
    const { data: savedRows, error: savedError } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (savedError) throw savedError
    if (!savedRows || savedRows.length === 0) return []

    const listingIds = savedRows.map((row) => row.listing_id)
    // Match getAll: only active listings surface. A save on a listing that's
    // since sold/deactivated just quietly drops off Saved rather than
    // rendering with no "unavailable" indicator (ListingCard has none today).
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

    const rowById = new Map(rows.map((row) => [row.id, row]))
    const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]))

    // Walk listingIds (not rows) to preserve most-recently-saved-first order;
    // a listing whose row or seller didn't come back (deleted since being
    // saved) is skipped rather than crashing the whole list.
    return listingIds.reduce<Listing[]>((acc, id) => {
      const row = rowById.get(id)
      const seller = row && sellerById.get(row.seller_id)
      if (row && seller) acc.push(toListing(row, seller, true))
      return acc
    }, [])
  },
  // Not yet called anywhere — wiring the view-count bump into
  // ListingDetailScreen is AX-203's job. Goes through the increment_listing_views
  // RPC (0006) rather than a plain update(): listings_update_own (0002) scopes
  // UPDATE to the seller only, so a non-owner viewer's update() would silently
  // affect 0 rows under RLS instead of erroring — views would never increment
  // for anyone but the seller. The RPC is SECURITY DEFINER so any authenticated
  // viewer can bump the counter, and the increment itself is a single atomic
  // `views = views + 1` in SQL rather than a racy read-then-write.
  async incrementViews(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_listing_views', { listing_id: id })
    if (error) throw error
  },
}
