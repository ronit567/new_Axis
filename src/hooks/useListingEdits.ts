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
// list — the same shape PhotoPicker renders either kind from. Remote photos
// also carry their existing thumb URL (0023) so a reorder/remove keeps
// image_urls and thumb_urls index-aligned without re-uploading anything.
export type EditablePhoto = LocalPhoto & { isLocal: boolean; thumbUri?: string }

export type ResolvedListingPhotos = { imageUrls: string[]; thumbUrls: string[] }

// Splits a mixed photo list, uploads only the local entries (via the
// timestamped-filename edit path — never the index-named create path, so an
// in-progress edit can't collide with a still-live original), and re-merges
// into the final ordered URL arrays the DB expects for image_urls/thumb_urls
// (or proposed_image_urls). Exported so EditListingScreen can resolve photos
// exactly once and hand the same URLs to both the direct-update and
// edit-request paths (avoids double-uploading on the race-fallback path).
export async function resolveListingPhotos(
  sellerId: string,
  listingId: string,
  photos: EditablePhoto[],
): Promise<ResolvedListingPhotos> {
  const localPhotos = photos.filter((p) => p.isLocal)
  const uploaded =
    localPhotos.length > 0
      ? await StorageRepository.uploadListingImageAdditions(sellerId, listingId, localPhotos)
      : { urls: [], thumbUrls: [], paths: [] }

  const imageUrls: string[] = []
  const thumbUrls: string[] = []
  let i = 0
  for (const p of photos) {
    if (p.isLocal) {
      imageUrls.push(uploaded.urls[i])
      thumbUrls.push(uploaded.thumbUrls[i])
      i += 1
    } else {
      imageUrls.push(p.uri)
      // A kept remote photo without a thumb (pre-0023 row) persists its
      // detail URL as the thumb — same degradation the mapper applies.
      thumbUrls.push(p.thumbUri ?? p.uri)
    }
  }
  return { imageUrls, thumbUrls }
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
  // image_urls is present only when the photo set changed and is resolved
  // (uploaded) by the caller once, up front — the patch never gets an
  // image_urls key unless photos actually changed. Low-risk-only saves
  // (price/description/is_free/is_trade) omit it entirely.
  patch: Partial<UpdateListingInput>
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
    mutationFn: async ({ listingId, patch }: UpdateListingMutationInput) => {
      if (!user) throw new Error('Not signed in')

      await ListingRepository.updateListing(listingId, user.id, patch)
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
  // Present only when the photo set changed — the final resolved (already-
  // uploaded) ordered URL set, mixing kept-remote and newly-uploaded photos.
  // Resolved once by the caller so the race-fallback path (direct update
  // rejected by the server-side guard) doesn't re-upload the same photos.
  imageUrls?: string[]
}

// EditListingScreen's Save action for an engaged listing (or the race
// fallback when a direct update was rejected by the server-side guard):
// files a review request for the scam-vector fields instead of writing them.
export function useCreateEditRequest() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listingId, imageUrls, ...proposed }: CreateEditRequestInput) => {
      if (!user) throw new Error('Not signed in')

      await ListingEditRequestRepository.create(user.id, listingId, {
        ...proposed,
        imageUrls,
      })
    },
    onSuccess: (_data, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingEditRequest(listingId) })
    },
  })
}

// A photo set changed only if the count differs or any entry is either a
// newly-picked local photo or a kept remote photo whose URL moved position —
// image_urls equality is order-sensitive (0021).
export function photosChanged(photos: EditablePhoto[], original: string[]): boolean {
  if (photos.length !== original.length) return true
  return photos.some((p, i) => p.isLocal || p.uri !== original[i])
}
