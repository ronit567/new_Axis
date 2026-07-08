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
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadNotificationCount: (userId: string) => ['unreadNotificationCount', userId] as const,
}
