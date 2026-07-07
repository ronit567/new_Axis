import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ProfileRepository,
  UpsertProfileInput,
} from '../repositories/ProfileRepository'
import { signOut, useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

export function useProfile(userId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => ProfileRepository.getById(userId),
    enabled: !!user && !!userId,
  })
}

export function useCurrentProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.currentProfile,
    queryFn: () => ProfileRepository.getCurrent(),
    enabled: !!user,
  })
}

export function useUpsertProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertProfileInput) => {
      if (!user) throw new Error('Not signed in')
      return ProfileRepository.upsert(user.id, input)
    },
    onSuccess: profile => {
      // Set the cache directly (not just invalidate) so RootNavigator's
      // profile-existence gate flips to the main app immediately instead of
      // waiting on a background refetch.
      queryClient.setQueryData(queryKeys.currentProfile, profile)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => ProfileRepository.deleteAccount(),
    // The account (and its session) no longer exists server-side once this
    // resolves — reuse the same offline-safe signOut as the explicit sign-out
    // button to clear the local session/tokens and the query cache.
    onSuccess: () => signOut(),
  })
}
