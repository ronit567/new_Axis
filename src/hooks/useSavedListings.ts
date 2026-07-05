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
// back out of it). The saved-listings cache and every cached listings AND
// search page get updated in place so Home, Saved, and Search reflect the
// toggle together; onError restores the exact snapshots taken in onMutate.
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
      const listingKey = queryKeys.listing(listing.id)
      const willSave = !listing.saved

      // Every cache that carries a `saved` flag is patched here so the heart
      // flips instantly on whatever surface the tap came from. ['listings'] and
      // ['search'] are InfiniteData pages; ['sellerListings'] is a flat
      // Listing[]; ['listing', id] is a single Listing. The single-listing
      // query must be cancelled too — its key doesn't match the ['listings']
      // prefix, and an in-flight refetch landing mid-mutation would hand
      // ListingDetailScreen the pre-toggle `saved`, reverting the user's tap.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: savedKey }),
        queryClient.cancelQueries({ queryKey: ['listings'] }),
        queryClient.cancelQueries({ queryKey: ['search'] }),
        queryClient.cancelQueries({ queryKey: ['sellerListings'] }),
        queryClient.cancelQueries({ queryKey: listingKey }),
      ])

      const previousSaved = queryClient.getQueryData<Listing[]>(savedKey)
      const previousListingsPages = [
        ...queryClient.getQueriesData<InfiniteData<ListingsPage, number>>({
          queryKey: ['listings'],
        }),
        ...queryClient.getQueriesData<InfiniteData<ListingsPage, number>>({
          queryKey: ['search'],
        }),
      ]
      const previousSellerListings = queryClient.getQueriesData<Listing[]>({
        queryKey: ['sellerListings'],
      })
      const previousListing = queryClient.getQueryData<Listing | null>(listingKey)

      queryClient.setQueryData<Listing[]>(savedKey, (old = []) =>
        willSave
          ? [{ ...listing, saved: true }, ...old.filter((l) => l.id !== listing.id)]
          : old.filter((l) => l.id !== listing.id),
      )

      const flipSavedInPages = (old?: InfiniteData<ListingsPage, number>) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === listing.id ? { ...item, saved: willSave } : item,
            ),
          })),
        }
      queryClient.setQueriesData<InfiniteData<ListingsPage, number>>(
        { queryKey: ['listings'] },
        flipSavedInPages,
      )
      queryClient.setQueriesData<InfiniteData<ListingsPage, number>>(
        { queryKey: ['search'] },
        flipSavedInPages,
      )

      // Seller storefronts are a flat Listing[] (not paged), so patch the
      // matching row's saved flag directly.
      queryClient.setQueriesData<Listing[]>({ queryKey: ['sellerListings'] }, (old) =>
        old?.map((item) => (item.id === listing.id ? { ...item, saved: willSave } : item)),
      )

      queryClient.setQueryData<Listing | null>(listingKey, (old) =>
        old ? { ...old, saved: willSave } : old,
      )

      return {
        savedKey,
        listingKey,
        previousSaved,
        previousListingsPages,
        previousSellerListings,
        previousListing,
      }
    },
    onError: (_err, _listing, context) => {
      if (!context) return
      queryClient.setQueryData(context.savedKey, context.previousSaved)
      context.previousListingsPages.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
      context.previousSellerListings.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
      // Only restore what was optimistically flipped — if the detail query was
      // never fetched, previousListing is undefined and setQueryData would be
      // a no-op anyway, but skip it explicitly for clarity.
      if (context.previousListing !== undefined) {
        queryClient.setQueryData(context.listingKey, context.previousListing)
      }
    },
    onSuccess: (_data, listing) => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.savedListings(user.id),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      // Search results carry their own `saved` flag (ListingRepository.search),
      // so a toggle from Home/Saved/Detail needs to bust the search cache too,
      // not just the toggle done from search itself.
      queryClient.invalidateQueries({ queryKey: ['search'] })
      // Seller storefronts were patched optimistically above; invalidate to
      // reconcile with the server like the other saved-flag caches.
      queryClient.invalidateQueries({ queryKey: ['sellerListings'] })
      // Also invalidate the single-listing cache — ListingDetailScreen reads
      // `saved` off this query too, and without this it never learns the
      // toggle persisted, so a later refetch there would look unchanged.
      queryClient.invalidateQueries({ queryKey: queryKeys.listing(listing.id) })
    },
  })
}
