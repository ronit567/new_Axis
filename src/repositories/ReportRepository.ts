import { supabase } from '../lib/supabase'
import type { ReportReason, ReportTarget } from '../types'

export type CreateReportInput = {
  targetType: ReportTarget
  reason: ReportReason
  targetUserId?: string
  targetListingId?: string
  targetReviewId?: string
}

export const ReportRepository = {
  // Lands a row in the moderation queue (migration 0011). The
  // reports_target_present constraint requires at least one of the three
  // target columns — callers always have one, per ReportTarget. A 'review'
  // report sends the review *and* its author, the same way a 'listing' report
  // sends the listing and its seller, so a moderator can act on either
  // without a second lookup.
  async create(reporterId: string, input: CreateReportInput): Promise<void> {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      target_type: input.targetType,
      target_user_id: input.targetUserId ?? null,
      target_listing_id: input.targetListingId ?? null,
      target_review_id: input.targetReviewId ?? null,
      reason: input.reason,
    })
    if (error) throw error
  },
}
