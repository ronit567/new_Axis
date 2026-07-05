import { useEffect, useState } from 'react'
import * as Crypto from 'expo-crypto'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
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

const SEARCH_DEBOUNCE_MS = 300

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

  return { ...query, refreshFirstPage }
}

export function useListing(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => ListingRepository.getById(id),
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
  })
}

// Form input: image_urls doesn't exist yet at submit time, only the local
// picker photos — uploadListingImages produces the real URLs during the mutation.
export type CreateListingFormInput = Omit<CreateListingInput, 'image_urls'> & {
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
      const { urls, paths } =
        photos.length > 0
          ? await StorageRepository.uploadListingImages(user.id, listingId, photos)
          : { urls: [], paths: [] }

      try {
        return await ListingRepository.create(user.id, listingId, {
          ...fields,
          image_urls: urls,
        })
      } catch (error) {
        // The row never got created — don't leave the uploaded photos orphaned.
        await StorageRepository.deleteListingImages(paths)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      if (user) queryClient.invalidateQueries({ queryKey: queryKeys.myListings(user.id) })
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
