import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BlockRepository } from '../repositories/BlockRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// Blocking hides the blocked user's listings/profile/messages from the
// blocker via the existing is_blocked() RLS (0002) — this mutation just
// writes the row. Invalidate every cache RLS now filters differently so the
// block takes effect immediately instead of waiting on a natural refetch.
export function useBlockUser() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!user) throw new Error('Not signed in')
      return BlockRepository.create(user.id, blockedId)
    },
    onSuccess: (_data, blockedId) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['sellerListings'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(blockedId) })
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations(user.id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.savedListings(user.id) })
      }
    },
  })
}
