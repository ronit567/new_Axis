import { supabase } from '../lib/supabase'
import type { ReportReason, ReportTarget } from '../types'

export type CreateReportInput = {
  targetType: ReportTarget
  reason: ReportReason
  targetUserId?: string
  targetListingId?: string
}

export const ReportRepository = {
  // Lands a row in the moderation queue (migration 0010). RLS's
  // reports_target_present constraint requires at least one of
  // targetUserId/targetListingId — callers always have one, per ReportTarget.
  async create(reporterId: string, input: CreateReportInput): Promise<void> {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      target_type: input.targetType,
      target_user_id: input.targetUserId ?? null,
      target_listing_id: input.targetListingId ?? null,
      reason: input.reason,
    })
    if (error) throw error
  },
}
