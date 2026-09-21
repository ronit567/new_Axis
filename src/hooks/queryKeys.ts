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
  // The thread is the (listing, person) pair (0051), so the cache key is too:
  // two chats with the same partner about different listings are two entries.
  // `null` — the listing-less bucket — is spelled 'none' rather than left as
  // null so the key is a plain string tuple that serializes predictably and
  // can never collide with a real listing id.
  messages: (partnerId: string, listingId: string | null) =>
    ['messages', partnerId, listingId ?? 'none'] as const,
  blockedUsers: (userId: string) => ['blockedUsers', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadNotificationCount: (userId: string) => ['unreadNotificationCount', userId] as const,
  // 0021: UX-only "is this listing already engaged" check + "is there a
  // pending edit request" check, both keyed per listing.
  listingEngagement: (id: string) => ['listingEngagement', id] as const,
  pendingEditRequest: (id: string) => ['pendingEditRequest', id] as const,
}
