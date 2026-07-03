// Single source of truth for listing categories. Both the Home browse filter
// and the CreateListing picker derive from this, so a category can never be
// browsable-but-not-creatable (or vice versa).
export const LISTING_CATEGORIES = [
  'Textbooks',
  'Furniture',
  'Electronics',
  'Tickets',
  'Clothing',
  'Sports',
  'Other',
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

// The Home feed adds an "All" sentinel in front of the real categories.
export const BROWSE_ALL = 'All' as const;
export const BROWSE_CATEGORIES = [BROWSE_ALL, ...LISTING_CATEGORIES] as const;
