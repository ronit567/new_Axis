import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { ListingRepository, ListingsPage } from '../repositories/ListingRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import { Listing } from '../types'

export function useSavedListings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.savedListings(user?.id ?? ''),
    queryFn: () => {
      if (!user) return []
      return ListingRepository.getSavedByUser(user.id)
    },
    enabled: !!user,
  })
}

// AX-201/AX-202: the heart must flip instantly, so the mutation takes the
// whole Listing (not just its id) — `listing.saved` is the pre-toggle source
// of truth for which direction to apply, and a full Listing is what's needed
// to optimistically insert a newly-saved item into the saved-listings cache
// (that query may not have been fetched yet, so we can't read the direction
// back out of it). Both the saved-listings cache and every cached listings
// page get updated in place so Home and Saved reflect the toggle together;
// onError restores the exact snapshots taken in onMutate.
export function useToggleSaved() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (listing: Listing) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.toggleSaved(listing.id, user.id)
    },
    onMutate: async (listing) => {
      if (!user) return undefined
      const savedKey = queryKeys.savedListings(user.id)
      const willSave = !listing.saved

      await Promise.all([
        queryClient.cancelQueries({ queryKey: savedKey }),
        queryClient.cancelQueries({ queryKey: ['listings'] }),
      ])

      const previousSaved = queryClient.getQueryData<Listing[]>(savedKey)
      const previousListingsPages = queryClient.getQueriesData<InfiniteData<ListingsPage, number>>(
        { queryKey: ['listings'] },
      )

      queryClient.setQueryData<Listing[]>(savedKey, (old = []) =>
        willSave
          ? [{ ...listing, saved: true }, ...old.filter((l) => l.id !== listing.id)]
          : old.filter((l) => l.id !== listing.id),
      )

      queryClient.setQueriesData<InfiniteData<ListingsPage, number>>(
        { queryKey: ['listings'] },
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === listing.id ? { ...item, saved: willSave } : item,
              ),
            })),
          },
      )

      return { savedKey, previousSaved, previousListingsPages }
    },
    onError: (_err, _listing, context) => {
      if (!context) return
      queryClient.setQueryData(context.savedKey, context.previousSaved)
      context.previousListingsPages.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSuccess: (_data, listing) => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.savedListings(user.id),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      // Also invalidate the single-listing cache — ListingDetailScreen reads
      // `saved` off this query too, and without this it never learns the
      // toggle persisted, so a later refetch there would look unchanged.
      queryClient.invalidateQueries({ queryKey: queryKeys.listing(listing.id) })
    },
  })
}
