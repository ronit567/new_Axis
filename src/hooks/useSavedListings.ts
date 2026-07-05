import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListingRepository } from '../repositories/ListingRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

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

export function useToggleSaved() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listingId: string) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.toggleSaved(listingId, user.id)
    },
    onSuccess: (_data, listingId) => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.savedListings(user.id),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      // Also invalidate the single-listing cache — ListingDetailScreen reads
      // `saved` off this query too, and without this it never learns the
      // toggle persisted, so a later refetch there would look unchanged.
      queryClient.invalidateQueries({ queryKey: queryKeys.listing(listingId) })
    },
  })
}
