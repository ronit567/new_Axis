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
  ListingsPage,
  LISTINGS_PAGE_SIZE,
} from '../repositories/ListingRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

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
    queryFn: () => {
      if (!user) return null
      return ListingRepository.getById(id, user.id)
    },
    enabled: !!user && !!id,
  })
}

export function useCreateListing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListingInput) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.create(user.id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}
