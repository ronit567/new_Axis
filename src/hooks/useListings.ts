import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ListingRepository,
  CreateListingInput,
  LISTINGS_PAGE_SIZE,
} from '../repositories/ListingRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// Home feed. Gated on auth because listings RLS requires an authenticated user.
// Offset-paginated so pull-to-refresh/onEndReached hit real queries instead of
// fetching everything at once (further FlatList/perf tuning is AX-905).
export function useListings(category?: string) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: queryKeys.listings(category),
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
}

export function useListing(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => ListingRepository.getById(id),
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
