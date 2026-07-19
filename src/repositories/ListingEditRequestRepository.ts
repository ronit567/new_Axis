import { supabase } from '../lib/supabase'
import { toListingEditRequest } from './mappers'
import type { ListingEditRequest } from '../types'
import type { ListingEditRequestRow } from '../types/database'

export type ProposedListingEdit = {
  title?: string
  category?: string
  condition?: string
  imageUrls?: string[]
  // Grid variants for the proposed photo set, index-parallel to imageUrls
  // (0024) — only meaningful when imageUrls is present. apply_listing_edit
  // promotes both together so a reviewed photo change keeps its thumbs.
  thumbUrls?: string[]
}

export const ListingEditRequestRepository = {
  // 0021: files a review request for the scam-vector fields of an engaged
  // listing. An omitted proposed* field means "no change" — undefined maps to
  // null rather than being left out of the insert, matching the DB's
  // "NULL = unchanged" convention (ler_has_a_change requires at least one
  // non-null proposed column, so callers always supply something).
  async create(
    requesterId: string,
    listingId: string,
    proposed: ProposedListingEdit,
  ): Promise<void> {
    const { error } = await supabase.from('listing_edit_requests').insert({
      listing_id: listingId,
      requester_id: requesterId,
      proposed_title: proposed.title ?? null,
      proposed_category: proposed.category ?? null,
      proposed_condition: proposed.condition ?? null,
      proposed_image_urls: proposed.imageUrls ?? null,
      proposed_thumb_urls: proposed.thumbUrls ?? null,
    })
    if (error) throw error
  },
  // EditListingScreen: is there already a pending request for this listing
  // (filed by the caller) so it can show the "pending review" banner and
  // disable resubmitting the same guarded fields. listing_edit_requests_select_own
  // (0021) scopes this to the caller's own requests.
  async getPending(listingId: string, requesterId: string): Promise<ListingEditRequest | null> {
    const { data, error } = await supabase
      .from('listing_edit_requests')
      .select('*')
      .eq('listing_id', listingId)
      .eq('requester_id', requesterId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    return toListingEditRequest(data as ListingEditRequestRow)
  },
}
