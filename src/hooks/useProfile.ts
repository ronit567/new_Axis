import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ProfileRepository,
  UpsertProfileInput,
} from '../repositories/ProfileRepository'
import { LocalPhoto, StorageRepository } from '../repositories/StorageRepository'
import { signOut, useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// UpsertProfileInput plus a photo change. Storage work happens inside the
// mutation (same shape as useCreateListing's photos handling) so a screen never
// orchestrates storage itself:
//   - photo present -> upload first, then persist the object path with the rest
//     of the profile;
//   - removePhoto   -> delete the stored files first, then clear the path.
// `photo` wins if both are set, since picking a new one supersedes a removal.
export type UpsertProfileVars = UpsertProfileInput & {
  photo?: LocalPhoto | null
  removePhoto?: boolean
}

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
    mutationFn: async ({ photo, removePhoto, ...input }: UpsertProfileVars) => {
      if (!user) throw new Error('Not signed in')
      if (photo) {
        input.avatar_url = await StorageRepository.uploadAvatar(user.id, photo)
      } else if (removePhoto) {
        // Files first, then the path. If the delete fails nothing has changed
        // and the user can retry. If the upsert fails after it, the profile
        // points at a missing object, which Avatar already renders as
        // initials — so the photo is never shown after being deleted.
        await StorageRepository.removeAvatar(user.id)
        input.avatar_url = null
      }
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
