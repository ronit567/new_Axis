import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ProfileRepository,
  UpsertProfileInput,
} from '../repositories/ProfileRepository'
import { useAuth } from '../context/AuthContext'
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
