import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FollowRepository } from '../repositories/FollowRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// Who the current user follows (FollowingScreen + the Profile tab's count).
export function useFollowing() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.following(user?.id ?? ''),
    queryFn: () => FollowRepository.listFollowing(user!.id),
    enabled: !!user,
  })
}

export function useIsFollowing(sellerId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.isFollowing(user?.id ?? '', sellerId),
    queryFn: () => FollowRepository.isFollowing(user!.id, sellerId),
    // Own profile has no follow button, so don't bother querying self-follow.
    enabled: !!user && !!sellerId && sellerId !== user.id,
  })
}

// Follow/unfollow with an optimistic isFollowing flip so the button toggles
// on tap instead of after the round-trip; both caches settle by invalidation.
export function useToggleFollow() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sellerId, next }: { sellerId: string; next: boolean }) => {
      if (!user) throw new Error('Not signed in')
      return next
        ? FollowRepository.follow(user.id, sellerId)
        : FollowRepository.unfollow(user.id, sellerId)
    },
    onMutate: async ({ sellerId, next }) => {
      if (!user) return
      const key = queryKeys.isFollowing(user.id, sellerId)
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData(key, next)
    },
    onSettled: (_data, _error, { sellerId }) => {
      if (!user) return
      queryClient.invalidateQueries({
        queryKey: queryKeys.isFollowing(user.id, sellerId),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.following(user.id) })
    },
  })
}
