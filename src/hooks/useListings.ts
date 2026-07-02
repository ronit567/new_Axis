import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ListingRepository,
  CreateListingInput,
} from '../repositories/ListingRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// Browse feed. Gated on auth because listings RLS requires an authenticated user.
export function useListings(category?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.listings(category),
    queryFn: () => ListingRepository.getAll(category),
    enabled: !!user,
  })
}

export function useListing(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => ListingRepository.getById(id),
    enabled: !!user && !!id,
  })
}

export function useCreateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListingInput) => ListingRepository.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}
