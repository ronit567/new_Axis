import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ListingRepository,
  CreateListingInput,
  ListingSearchFilters,
} from '../repositories/ListingRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

const SEARCH_DEBOUNCE_MS = 300

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

// Debounces `query` so keystrokes don't each fire a request; `filters` apply
// immediately since they come from discrete taps, not typing.
export function useSearchListings(query: string, filters: ListingSearchFilters) {
  const { user } = useAuth()
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  return useQuery({
    queryKey: queryKeys.search(debouncedQuery, filters),
    queryFn: () => ListingRepository.search(debouncedQuery, filters, user?.id),
    enabled: !!user,
  })
}

export function useCreateListing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListingInput) => {
      if (!user) throw new Error('Not signed in')
      return ListingRepository.create(user.id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
    },
  })
}
