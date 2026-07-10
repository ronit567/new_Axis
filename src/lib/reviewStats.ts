import type { Review } from '../types';

// Mean star rating across a seller's reviews, or 0 when there are none.
// ProfileScreen, SellerProfileScreen, and ReviewSummary all derive their
// average from this so the header trust row can't drift from the breakdown.
export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
