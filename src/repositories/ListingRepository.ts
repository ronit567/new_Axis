import { supabase } from '../lib/supabase'
import { toListing, toMyListing } from './mappers'
import { Listing, ListingCondition, MyListing } from '../types'
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

// 0021/pickup picker: pickup is a low-risk field (never review-gated, same as
// price/description/is_free/is_trade) — both CreateListingScreen and
// EditListingScreen can set it directly.
export type UpdateListingInput = CreateListingInput

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

// The shape here is the contract screens/hooks build against so nothing
// imports supabase directly.
export const ListingRepository = {
  async getAll(userId: string, options: GetAllListingsOptions = {}): Promise<ListingsPage> {
    const { category, limit = LISTINGS_PAGE_SIZE, offset = 0 } = options

    // Exclude the caller's own listings — the home feed is for browsing what
    // *other* people are selling; a seller manages their own listings from
    // Profile/ManageListings. Filtered server-side (not in the reduce below) so
    // it happens before range()/rawCount and pagination stays correct.
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .neq('seller_id', userId)
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
  // Takes the viewer's id explicitly (useListing already has it from useAuth)
  // rather than resolving it from the session like main's interim version did
  // — one fewer auth round trip, and the seller/saved lookups run in parallel.
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
    //
    // The save count is secondary metadata (shown only on ManageListings). If
    // the RPC errors — e.g. 0006 isn't applied in this environment — fall back
    // to 0 rather than failing the whole own-listings fetch: otherwise the
    // owner's Profile and ManageListings would show ZERO listings because of a
    // non-critical count lookup, even though the listings themselves loaded
    // fine (this is the getBySeller-only failure that made Profile read empty
    // while the public storefront via getActiveBySeller still rendered them).
    const { data: saveCounts, error: savesError } = await supabase.rpc('my_listing_save_counts')

    const savesByListing = new Map(
      savesError ? [] : (saveCounts ?? []).map(({ listing_id, saves }) => [listing_id, saves]),
    )

    return rows.map((row) => toMyListing(row, savesByListing.get(row.id) ?? 0))
  },
  // SellerProfileScreen: another user's public storefront — active listings
  // only (unlike getBySeller, which is the owner's own manage view), with the
  // viewer's saved flags folded in. Same join/skip rules as getAll.
  async getActiveBySeller(sellerId: string, viewerId: string): Promise<Listing[]> {
    const { data: rows, error } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) throw error
    if (!rows || rows.length === 0) return []

    const [{ data: sellerRow, error: sellerError }, { data: savedRows, error: savedError }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', sellerId).maybeSingle(),
        supabase
          .from('saved_listings')
          .select('listing_id')
          .eq('user_id', viewerId)
          .in(
            'listing_id',
            rows.map((row) => row.id),
          ),
      ])
    if (sellerError) throw sellerError
    if (savedError) throw savedError

    // seller_id is a NOT NULL FK, so a missing profile means a broken
    // reference — treat the storefront as empty rather than crash it.
    if (!sellerRow) return []

    const savedIds = new Set((savedRows ?? []).map((row) => row.listing_id))
    return rows.map((row) => toListing(row, sellerRow, savedIds.has(row.id)))
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

    // Exclude the caller's own listings, same as the home feed (getAll): the
    // marketplace surfaces other people's items, so a seller shouldn't turn up
    // their own listing while browsing/searching. A signed-out search (no
    // currentUserId) has no owner to exclude.
    if (currentUserId) request = request.neq('seller_id', currentUserId)

    if (trimmed) request = request.or(buildTextFilter(trimmed))
    if (filters.categories?.length) request = request.in('category', filters.categories)
    if (filters.priceMax != null) request = request.lte('price', filters.priceMax)
    if (filters.condition) request = request.eq('condition', filters.condition)

    const { data, error } = await request
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error
    if (!data || data.length === 0) return { items: [], rawCount: 0 }

    const rows = data as unknown as (ListingRow & { seller: ProfileRow | null })[]
    const savedIds = currentUserId
      ? await getSavedIds(currentUserId, rows.map((row) => row.id))
      : new Set<string>()

    // seller_id is a NOT NULL FK, so a missing seller means a broken
    // reference — skip rather than crash the whole search response over one
    // bad row (mirrors the same guard in getAll). rawCount still reflects
    // rows.length so pagination isn't thrown off by a dropped row.
    const items = rows.reduce<Listing[]>((acc, { seller, ...row }) => {
      if (seller) acc.push(toListing(row, seller, savedIds.has(row.id)))
      return acc
    }, [])
    return { items, rawCount: rows.length }
  },
  // Not yet called anywhere — wiring the view-count bump into
  // ListingDetailScreen is AX-203's job. Goes through the increment_listing_views
  // RPC (0007) rather than a plain update(): listings_update_own (0002) scopes
  // UPDATE to the seller only, so a non-owner viewer's update() would silently
  // affect 0 rows under RLS instead of erroring — views would never increment
  // for anyone but the seller. The RPC is SECURITY DEFINER so any authenticated
  // viewer can bump the counter, the increment itself is a single atomic
  // `views = views + 1` in SQL rather than a racy read-then-write, and the RPC
  // skips the owner's own views server-side so a seller can't inflate their
  // count. Per-viewer dedup (one count per unique viewer) is AX-203's call.
  async incrementViews(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_listing_views', { listing_id: id })
    if (error) throw error
  },
  // AX-304: seller marks their own listing sold. RLS (listings_update_own) already
  // scopes UPDATE to the owner; the seller_id filter is explicit defense-in-depth
  // and keeps the call testable. soldFor is derived from price by toMyListing —
  // there is no separate sale-price column, so status is the only field to change.
  async markSold(listingId: string, sellerId: string): Promise<void> {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', listingId)
      .eq('seller_id', sellerId)
    if (error) throw error
  },
  // AX-304: relist a sold item back to active.
  async relist(listingId: string, sellerId: string): Promise<void> {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'active' })
      .eq('id', listingId)
      .eq('seller_id', sellerId)
    if (error) throw error
  },
  // AX-304: hard delete (roadmap "delete with confirm"). saved_listings/messages
  // cascade, notifications null out via the FKs in 0001. Orphaned storage images
  // are left as-is (storage GC is a separate pass).
  async deleteListing(listingId: string, sellerId: string): Promise<void> {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)
      .eq('seller_id', sellerId)
    if (error) throw error
  },
  // 0021: low-risk edits (price/description/is_free/is_trade) go straight
  // through here regardless of engagement — those fields are never guarded.
  // A patch that also touches a scam-vector field (title/category/condition/
  // image_urls) only reaches here when the caller has already confirmed the
  // listing isn't engaged; guard_engaged_listing_edit (0021) is the real
  // authority and rejects the write server-side if that turns out to be
  // stale, surfacing as a thrown 'listing_edit_requires_review' error.
  async updateListing(
    listingId: string,
    sellerId: string,
    patch: Partial<UpdateListingInput>,
  ): Promise<void> {
    const { error } = await supabase
      .from('listings')
      .update(patch)
      .eq('id', listingId)
      .eq('seller_id', sellerId)
    if (error) throw error
  },
  // 0021: UX-only client check — is the caller's listing already engaged
  // (saved or messaged about by someone else)? Determines whether
  // EditListingScreen offers a direct save or files a review request. The
  // guard_engaged_listing_edit trigger, not this call, is the real authority.
  async isEngaged(listingId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_listing_engaged', {
      p_listing_id: listingId,
    })
    if (error) throw error
    return !!data
  },
}
