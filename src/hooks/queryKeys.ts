// Central query-key factory so invalidation stays consistent. Broad prefixes
// (['listings'], ['profile']) let mutations invalidate whole groups at once.
export const queryKeys = {
  listings: (category?: string) => ['listings', category ?? 'all'] as const,
  listing: (id: string) => ['listing', id] as const,
  search: (query: string, filters: unknown) => ['search', query, filters] as const,
  savedListings: (userId: string) => ['savedListings', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  currentProfile: ['profile', 'me'] as const,
  conversations: (userId: string) => ['conversations', userId] as const,
  messages: (listingId: string, partnerId: string) =>
    ['messages', listingId, partnerId] as const,
}
