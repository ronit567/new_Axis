import { supabase } from '../lib/supabase'
import type { Review } from '../types'
import type { ProfileRow, ReviewRow } from '../types/database'
import { toReview } from './mappers'

export type UpsertReviewInput = {
  sellerId: string
  rating: number // 1–5
  body: string
}

export const ReviewRepository = {
  // A seller's reviews, newest first. Batch-joins reviewer profiles (same
  // manual-join shape as NotificationRepository.list); a review whose
  // reviewer profile is RLS-hidden (blocked with the viewer) is dropped,
  // matching the actorless-notification convention.
  async listForSeller(sellerId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as ReviewRow[]
    if (rows.length === 0) return []

    const reviewerIds = [...new Set(rows.map((row) => row.reviewer_id))]
    const { data: reviewers, error: reviewersError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', reviewerIds)
    if (reviewersError) throw reviewersError
    const reviewerById = new Map(
      ((reviewers ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    )

    return rows.reduce<Review[]>((acc, row) => {
      const reviewer = reviewerById.get(row.reviewer_id)
      if (reviewer) acc.push(toReview(row, reviewer))
      return acc
    }, [])
  },

  // One review per (seller, reviewer) — writing again edits in place. This is
  // an explicit select-then-update/insert rather than a PostgREST upsert
  // because the UPDATE grant is column-restricted to (rating, body) (0020);
  // ON CONFLICT DO UPDATE would try to set the identity columns too and be
  // denied. The INSERT path is where RLS enforces the "you've chatted with
  // this seller" gate — callers should surface that failure as such.
  async upsertOwn(reviewerId: string, input: UpsertReviewInput): Promise<void> {
    const { data: existing, error: existingError } = await supabase
      .from('reviews')
      .select('id')
      .eq('seller_id', input.sellerId)
      .eq('reviewer_id', reviewerId)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing) {
      const { error } = await supabase
        .from('reviews')
        .update({ rating: input.rating, body: input.body })
        .eq('id', existing.id)
      if (error) throw error
      return
    }

    const { error } = await supabase.from('reviews').insert({
      seller_id: input.sellerId,
      reviewer_id: reviewerId,
      rating: input.rating,
      body: input.body,
    })
    if (error) throw error
  },
}
