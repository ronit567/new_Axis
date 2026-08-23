import { useEffect, useState } from 'react'
import * as Crypto from 'expo-crypto'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import {
  ListingRepository,
  CreateListingInput,
  ListingSearchFilters,
  ListingsPage,
  LISTINGS_PAGE_SIZE,
  SEARCH_PAGE_SIZE,
} from '../repositories/ListingRepository'
import { StorageRepository, type LocalPhoto } from '../repositories/StorageRepository'

export type { LocalPhoto }
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import { MyListing } from '../types'

const SEARCH_DEBOUNCE_MS = 300
// Matches QueryProvider's default; named because the feed reasons about it.
const FEED_STALE_MS = 2 * 60 * 1000

// Home feed. Gated on auth because listings RLS requires an authenticated user.
// Offset-paginated so pull-to-refresh/onEndReached hit real queries instead of
// fetching everything at once (further FlatList/perf tuning is AX-905).
export function useListings(category?: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = queryKeys.listings(category)

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => {
      if (!user) return { items: [], rawCount: 0 }
      return ListingRepository.getAll(user.id, {
        category,
        limit: LISTINGS_PAGE_SIZE,
        offset: pageParam,
      })
    },
    initialPageParam: 0,
    // Key off rawCount, not items.length — a page can have fewer mapped items
    // than rows fetched (see ListingRepository.getAll) without being the last page.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rawCount < LISTINGS_PAGE_SIZE ? undefined : allPages.length * LISTINGS_PAGE_SIZE,
    enabled: !!user,
    staleTime: FEED_STALE_MS,
    // Handled by the effect below. Left on, a stale remount refetches EVERY
    // loaded page, strictly one after another.
    refetchOnMount: false,
  })

  // Pull-to-refresh should re-check the top of the feed, not re-run one
  // network request per page the user has scrolled through — react-query's
  // plain refetch() re-fetches every loaded page. Trim the cache down to the
  // first page before refetching so exactly one request fires; deeper pages
  // are dropped and reload naturally as the user scrolls back down.
  const refreshFirstPage = () => {
    queryClient.setQueryData<InfiniteData<ListingsPage, number>>(queryKey, (old) =>
      old && old.pages.length > 1
        ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) }
        : old,
    )
    return queryClient.refetchQueries({ queryKey, exact: true })
  }

  // MainScreen unmounts a tab when you leave it, so coming back to Home is a
  // remount, and the list is back at the top either way. Someone who scrolled
  // eight pages, spent three minutes in Messages and returned used to trigger
  // sixteen sequential requests to repaint a list showing page one. A stale
  // return now costs what pull-to-refresh costs: the first page. A first load
  // (no data yet) is untouched — the query fetches that itself.
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    const state = queryClient.getQueryState(queryKey)
    if (!state?.data) return
    const stale = state.isInvalidated || Date.now() - state.dataUpdatedAt > FEED_STALE_MS
    if (stale) void refreshFirstPage()
    // Once per mount and per category; refreshFirstPage is a fresh closure each
    // render and must not re-trigger this.
  }, [userId, category])

  return { ...query, refreshFirstPage }
}

export function useListing(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => {
      if (!user) return null
      return ListingRepository.getById(id, user.id)
    },
    enabled: !!user && !!id,
  })
}

// Debounces both `query` and `filters` on the same timer — filter taps come
// in bursts (rapid category-chip toggling, holding the price +/- button)
// just like keystrokes do, so firing a request per tap while the filter
// sheet is still open would be wasteful. `filters` is a fresh object every
// render (the caller builds it inline), so it's compared by serialized value
// rather than reference for the effect to settle once taps stop.
//
// Offset-paginated like useListings, so a broad search isn't capped at one
// page with no way to see more — onEndReached loads the next page instead.
export function useSearchListings(query: string, filters: ListingSearchFilters) {
  const { user } = useAuth()
  const [debounced, setDebounced] = useState({ query, filters })
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ query, filters }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, filtersKey])

  return useInfiniteQuery({
    queryKey: queryKeys.search(debounced.query, debounced.filters),
    queryFn: ({ pageParam }) => {
      if (!user) return { items: [], rawCount: 0 }
      return ListingRepository.search(debounced.query, debounced.filters, user.id, {
        limit: SEARCH_PAGE_SIZE,
        offset: pageParam,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rawCount < SEARCH_PAGE_SIZE ? undefined : allPages.length * SEARCH_PAGE_SIZE,
    enabled: !!user,
    // Every debounced keystroke is a new query key, which starts with no data —
    // so the screen tore the whole results grid down to skeletons and rebuilt
    // it from nothing, several times per typed phrase. Keeping the previous
    // results on screen until the new ones land avoids both the flash and the
    // churn; `isPlaceholderData` tells the screen it is showing the old set.
    placeholderData: keepPreviousData,
  })
}

// Form input: image_urls/thumb_urls don't exist yet at submit time, only the
// local picker photos — uploadListingImages produces the real URLs during the
// mutation.
export type CreateListingFormInput = Omit<CreateListingInput, 'image_urls' | 'thumb_urls'> & {
  photos: LocalPhoto[]
}

export function useCreateListing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ photos, ...fields }: CreateListingFormInput) => {
      if (!user) throw new Error('Not signed in')

      // Generated up front so photos can upload to their final
      // {seller_id}/{listing_id}/... path before the listing row exists.
      const listingId = Crypto.randomUUID()
      const { urls, thumbUrls, paths } =
        photos.length > 0
          ? await StorageRepository.uploadListingImages(user.id, listingId, photos)
          : { urls: [], thumbUrls: [], paths: [] }

      try {
        return await ListingRepository.create(user.id, listingId, {
          ...fields,
          image_urls: urls,
          thumb_urls: thumbUrls,
        })
      } catch (error) {
        // The row never got created — don't leave the uploaded photos orphaned.
        await StorageRepository.deleteListingImages(paths)
        throw error
      }
    },
    // The poster's own feed and search never show their own listings (see
    // invalidateAfterListingMutation), so only their manage list and their own
    // storefront can change — not every storefront, and not the feed.
    onSuccess: () => {
      if (!user) return
      queryClient.invalidateQueries({ queryKey: queryKeys.myListings(user.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerListings(user.id) })
    },
  })
}

// ManageListingsScreen: the current user's own listings, any status.
export function useMyListings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.myListings(user?.id ?? ''),
    queryFn: () => ListingRepository.getBySeller(user!.id),
    enabled: !!user,
  })
}

// SellerProfileScreen: another user's active listings (public storefront).
export function useSellerListings(sellerId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.sellerListings(sellerId),
    queryFn: () => ListingRepository.getActiveBySeller(sellerId, user!.id),
    enabled: !!user && !!sellerId,
  })
}

// Every cache on THIS device that a change to one of the user's own listings can
// affect: their manage list, their own storefront, the listing's detail, and
// their saved list (in case they saved their own listing before that was
// hidden).
//
// Not the Home feed or search. Both exclude the caller's own listings in the
// query itself (`.neq('seller_id', userId)` in ListingRepository.getAll and
// .search), so nothing the user does to their own listing can change a row in
// either. Invalidating them anyway refetched every loaded page of the feed and
// of each cached search, two requests per page, on every create, mark-sold,
// relist, delete and edit — busiest at the start of term, when posting peaks.
// Other people's devices pick the change up on their own next fetch.
//
// Exported so useUpdateListing (useListingEdits.ts) can reuse it for the same
// invalidation surface a direct listing update affects.
export function invalidateAfterListingMutation(
  queryClient: QueryClient,
  userId: string,
  listingId: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.sellerListings(userId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.myListings(userId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.savedListings(userId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.listing(listingId) })
}

// AX-304: ManageListingsScreen's "mark sold" action. Optimistically flips the
// row in the myListings cache (and derives soldFor from price, matching
// toMyListing) so the tab counts/badge update instantly; onSuccess invalidates
// every other cache the status change can affect.
export function useMarkListingSold() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listingId: string) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.markSold(listingId, user.id)
    },
    onMutate: async (listingId) => {
      if (!user) return undefined
      const key = queryKeys.myListings(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<MyListing[]>(key)
      queryClient.setQueryData<MyListing[]>(key, (old) =>
        old?.map((l) =>
          l.id === listingId ? { ...l, status: 'sold' as const, soldFor: l.price } : l,
        ),
      )
      return { key, previous }
    },
    onError: (_e, _v, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSuccess: (_d, listingId) => {
      if (user) invalidateAfterListingMutation(queryClient, user.id, listingId)
    },
  })
}

// AX-304: ManageListingsScreen's "relist" action — the inverse of markSold.
export function useRelistListing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listingId: string) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.relist(listingId, user.id)
    },
    onMutate: async (listingId) => {
      if (!user) return undefined
      const key = queryKeys.myListings(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<MyListing[]>(key)
      queryClient.setQueryData<MyListing[]>(key, (old) =>
        old?.map((l) =>
          l.id === listingId ? { ...l, status: 'active' as const, soldFor: undefined } : l,
        ),
      )
      return { key, previous }
    },
    onError: (_e, _v, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSuccess: (_d, listingId) => {
      if (user) invalidateAfterListingMutation(queryClient, user.id, listingId)
    },
  })
}

// AX-304: ManageListingsScreen's "delete" action.
export function useDeleteListing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listingId: string) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.deleteListing(listingId, user.id)
    },
    onMutate: async (listingId) => {
      if (!user) return undefined
      const key = queryKeys.myListings(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<MyListing[]>(key)
      queryClient.setQueryData<MyListing[]>(key, (old) => old?.filter((l) => l.id !== listingId))
      return { key, previous }
    },
    onError: (_e, _v, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSuccess: (_d, listingId) => {
      if (user) invalidateAfterListingMutation(queryClient, user.id, listingId)
    },
  })
}
