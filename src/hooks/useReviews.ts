import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ReviewRepository,
  UpsertReviewInput,
} from '../repositories/ReviewRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

// A seller's written reviews, newest first. Screens derive the average
// rating/count from this list — there is no denormalized counter to trust.
export function useSellerReviews(sellerId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.sellerReviews(sellerId),
    queryFn: () => ReviewRepository.listForSeller(sellerId),
    enabled: !!user && !!sellerId,
  })
}

// Write (or edit — one review per reviewer per seller) the current user's
// review. RLS rejects reviewers who never messaged the seller (0020); the
// screen turns that failure into a human explanation.
export function useUpsertReview() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertReviewInput) => {
      if (!user) throw new Error('Not signed in')
      return ReviewRepository.upsertOwn(user.id, input)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sellerReviews(input.sellerId),
      })
    },
  })
}
