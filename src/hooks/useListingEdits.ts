import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ListingEditRequestRepository,
  type ProposedListingEdit,
} from '../repositories/ListingEditRequestRepository'
import { ListingRepository, type UpdateListingInput } from '../repositories/ListingRepository'
import { StorageRepository, type LocalPhoto } from '../repositories/StorageRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import { invalidateAfterListingMutation } from './useListings'

// 0021: EditListingScreen's photo grid mixes photos already live in storage
// (isLocal: false, uri is the public URL) with newly-picked device photos
// (isLocal: true, uri is a local file:// / content:// uri) in one ordered
// list — the same shape PhotoPicker renders either kind from.
export type EditablePhoto = LocalPhoto & { isLocal: boolean }

// Splits a mixed photo list, uploads only the local entries (via the
// timestamped-filename edit path — never the index-named create path, so an
// in-progress edit can't collide with a still-live original), and re-merges
// into the final ordered URL array the DB expects for image_urls /
// proposed_image_urls.
async function resolveImageUrls(
  sellerId: string,
  listingId: string,
  photos: EditablePhoto[],
): Promise<string[]> {
  const localPhotos = photos.filter((p) => p.isLocal)
  const uploaded =
    localPhotos.length > 0
      ? await StorageRepository.uploadListingImageAdditions(sellerId, listingId, localPhotos)
      : { urls: [], paths: [] }

  let i = 0
  return photos.map((p) => (p.isLocal ? uploaded.urls[i++] : p.uri))
}

// EditListingScreen's UX-only "has this listing already got outside
// interest" check — decides whether Save can write directly or must file a
// review request. The guard_engaged_listing_edit trigger (0021) is the real
// authority; this is best-effort so the common case (no engagement) skips
// the review flow entirely.
export function useListingEngagement(listingId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.listingEngagement(listingId),
    queryFn: () => ListingRepository.isEngaged(listingId),
    enabled: !!user && !!listingId,
  })
}

// EditListingScreen: is there already a pending edit request for this
// listing, so the screen can show a "pending review" banner and hold off on
// letting the seller resubmit the same guarded fields.
export function usePendingEditRequest(listingId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.pendingEditRequest(listingId),
    queryFn: () => {
      if (!user) return null
      return ListingEditRequestRepository.getPending(listingId, user.id)
    },
    enabled: !!user && !!listingId,
  })
}

export type UpdateListingMutationInput = {
  listingId: string
  patch: Partial<Omit<UpdateListingInput, 'image_urls'>>
  // Present only when the photo set changed. Low-risk-only saves (price/
  // description/is_free/is_trade) omit this entirely — the patch never gets
  // an image_urls key unless photos actually changed.
  photos?: EditablePhoto[]
}

// EditListingScreen's Save action for the direct-update path: either a
// low-risk-only patch (always safe, any engagement state) or a patch that
// also includes scam-vector fields (only ever sent when the caller has
// already confirmed the listing isn't engaged — see useListingEngagement).
// A stale engagement read is still caught server-side: guard_engaged_listing_edit
// rejects the write with 'listing_edit_requires_review', which the screen
// catches and turns into a fallback useCreateEditRequest call.
export function useUpdateListing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listingId, patch, photos }: UpdateListingMutationInput) => {
      if (!user) throw new Error('Not signed in')

      const fullPatch: Partial<UpdateListingInput> = photos
        ? { ...patch, image_urls: await resolveImageUrls(user.id, listingId, photos) }
        : patch

      await ListingRepository.updateListing(listingId, user.id, fullPatch)
    },
    onSuccess: (_data, { listingId }) => {
      if (!user) return
      invalidateAfterListingMutation(queryClient, user.id, listingId)
      queryClient.invalidateQueries({ queryKey: queryKeys.listingEngagement(listingId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingEditRequest(listingId) })
    },
  })
}

export type CreateEditRequestInput = Omit<ProposedListingEdit, 'imageUrls'> & {
  listingId: string
  // Present only when the photo set changed — the full desired ordered set,
  // mixing kept-remote and newly-picked local photos (see EditablePhoto).
  photos?: EditablePhoto[]
}

// EditListingScreen's Save action for an engaged listing (or the race
// fallback when a direct update was rejected by the server-side guard):
// files a review request for the scam-vector fields instead of writing them.
export function useCreateEditRequest() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listingId, photos, ...proposed }: CreateEditRequestInput) => {
      if (!user) throw new Error('Not signed in')

      const resolvedImageUrls = photos
        ? await resolveImageUrls(user.id, listingId, photos)
        : undefined

      await ListingEditRequestRepository.create(user.id, listingId, {
        ...proposed,
        imageUrls: resolvedImageUrls,
      })
    },
    onSuccess: (_data, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingEditRequest(listingId) })
    },
  })
}
