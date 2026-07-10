// Central query-key factory so invalidation stays consistent. Broad prefixes
// (['listings'], ['profile']) let mutations invalidate whole groups at once.
export const queryKeys = {
  listings: (category?: string) => ['listings', category ?? 'all'] as const,
  listing: (id: string) => ['listing', id] as const,
  search: (query: string, filters: unknown) => ['search', query, filters] as const,
  myListings: (userId: string) => ['myListings', userId] as const,
  // Deliberately NOT under the ['listings'] prefix: those caches are
  // InfiniteData pages, this one is a flat Listing[] — sharing the prefix
  // would let broad setQueriesData calls assume the wrong shape.
  sellerListings: (sellerId: string) => ['sellerListings', sellerId] as const,
  savedListings: (userId: string) => ['savedListings', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  currentProfile: ['profile', 'me'] as const,
  conversations: (userId: string) => ['conversations', userId] as const,
  // listing_id is nullable (a thread not tied to a listing) — normalize null to
  // 'none' so the cache key stays a stable string tuple.
  messages: (listingId: string | null, partnerId: string) =>
    ['messages', listingId ?? 'none', partnerId] as const,
  hasChattedWith: (userId: string, partnerId: string) =>
    ['hasChattedWith', userId, partnerId] as const,
  following: (userId: string) => ['following', userId] as const,
  isFollowing: (userId: string, sellerId: string) =>
    ['isFollowing', userId, sellerId] as const,
  sellerReviews: (sellerId: string) => ['sellerReviews', sellerId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadNotificationCount: (userId: string) => ['unreadNotificationCount', userId] as const,
  // 0021: UX-only "is this listing already engaged" check + "is there a
  // pending edit request" check, both keyed per listing.
  listingEngagement: (id: string) => ['listingEngagement', id] as const,
  pendingEditRequest: (id: string) => ['pendingEditRequest', id] as const,
}
