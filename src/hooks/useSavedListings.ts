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
    onSuccess: () => {
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
    },
  })
}
