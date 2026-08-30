import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BlockRepository } from '../repositories/BlockRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// Blocking/unblocking flips what is_blocked() RLS (0002) shows in BOTH
// directions, so both mutations invalidate every cache RLS now filters
// differently — the change takes effect immediately instead of waiting on a
// natural refetch.
function invalidateBlockSensitiveCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  otherId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['listings'] })
  queryClient.invalidateQueries({ queryKey: ['search'] })
  queryClient.invalidateQueries({ queryKey: ['sellerListings'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.profile(otherId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.savedListings(userId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers(userId) })
}

export function useBlockUser() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!user) throw new Error('Not signed in')
      return BlockRepository.create(user.id, blockedId)
    },
    onSuccess: (_data, blockedId) => {
      if (user) invalidateBlockSensitiveCaches(queryClient, user.id, blockedId)
    },
  })
}

// The Settings → Blocked users list (0033's my_blocked_users()).
export function useBlockedUsers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.blockedUsers(user?.id ?? 'anonymous'),
    queryFn: () => BlockRepository.listBlocked(),
    enabled: !!user,
  })
}

export function useUnblockUser() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!user) throw new Error('Not signed in')
      return BlockRepository.remove(user.id, blockedId)
    },
    onSuccess: (_data, blockedId) => {
      if (user) invalidateBlockSensitiveCaches(queryClient, user.id, blockedId)
    },
  })
}
