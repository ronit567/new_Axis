// The keystone mapping layer (AX-110): DB rows -> domain types.
//
// This is the ONE place the type <-> DB mismatch documented in PROJECT_ROADMAP.md
// is reconciled — seller joins, `created_at` -> "3d ago", the saved-listings join,
// and image/color placeholders. Repositories call these; screens never map.
// Keep all mapping logic here so no screen reinvents it.

import type { Listing, Seller, SellerProfile } from '../types';
import type { ListingRow, ProfileRow } from '../types/database';
import { timeAgo } from '../lib/timeAgo';

// --- Deterministic placeholder palettes -------------------------------------
// These reproduce the pastel card backgrounds and avatar colors from the mock so
// skeletons/placeholders look identical after migrating to live data. Real
// images (AX-402) and avatar uploads (AX-403) render on top of these fallbacks.
const IMAGE_COLORS = ['#E8E0F5', '#E4ECF8', '#EBE4F8', '#F0E8F8', '#E8ECF0', '#EDE8F8'] as const;
const AVATAR_COLORS = ['#5C2D91', '#7B4BB0', '#8E5DC4', '#6B3AA0', '#4C2478'] as const;

// dotColor is an "online" presence indicator, but there is no realtime presence
// system yet. Rather than imply everyone is online (green), default to a neutral
// muted grey meaning "presence unknown". Swap when presence lands.
const DEFAULT_DOT_COLOR = '#9E9EAE';

// Fallbacks for NOT-NULL-in-the-UI fields that are nullable in the DB.
const DEFAULT_YEAR = 1;
const DEFAULT_CATEGORY = 'Other';
const DEFAULT_CONDITION = 'N/A'; // matches the mock's tickets (no condition).

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// Stable index from a string seed (id). Sum-of-char-codes % length so the same id
// always maps to the same palette entry — skeletons stay visually consistent.
function hashToIndex(seed: string, length: number): number {
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i);
  return sum % length;
}

function pickImageColor(id: string): string {
  return IMAGE_COLORS[hashToIndex(id, IMAGE_COLORS.length)];
}

function pickAvatarColor(id: string): string {
  return AVATAR_COLORS[hashToIndex(id, AVATAR_COLORS.length)];
}

// "AK" from "Aria K.", "L" from "Liam". Used when the DB `initials` is null,
// and by SetupProfileScreen for a live avatar preview before the row exists.
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// created_at (ISO) -> "Sep 2024". UTC so the label is timezone-deterministic.
function formatJoinedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// Lightweight nested seller used inside a Listing.
export function toSeller(row: ProfileRow): Seller {
  return {
    id: row.id,
    name: row.name,
    year: row.year ?? DEFAULT_YEAR,
    location: row.location ?? '',
    program: row.program ?? '',
    dotColor: DEFAULT_DOT_COLOR,
  };
}

export function toListing(row: ListingRow, seller: ProfileRow, isSaved: boolean): Listing {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    condition: row.condition ?? DEFAULT_CONDITION,
    category: row.category ?? DEFAULT_CATEGORY,
    seller: toSeller(seller),
    saved: isSaved,
    // imageColor is always a deterministic placeholder color; the real image
    // (image_urls[0]) is rendered over it in AX-402. Empty image_urls => this is
    // all the card shows, so it must stay stable per id.
    imageColor: pickImageColor(row.id),
    // No `badge` column exists in the schema yet (the mock's "Price ↓" was
    // fabricated). Always null until a badge/price-history feature is designed.
    badge: null,
    description: row.description ?? '',
    views: row.views,
    postedAgo: timeAgo(row.created_at),
    pickup: row.pickup ?? '',
  };
}

type SellerStats = { listings: number; sold: number; replyTime: string };

// `stats` (including replyTime) is supplied by the repository, not read off the
// row here — it aggregates other tables (listing counts) plus the profile's
// reply_time. Keeping the aggregation in the caller keeps this mapper pure and
// stops "stats" logic from being split across two places.
export function toSellerProfile(row: ProfileRow, stats: SellerStats): SellerProfile {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials ?? deriveInitials(row.name),
    program: row.program ?? '',
    bio: row.bio ?? '',
    joinedDate: formatJoinedDate(row.created_at),
    // rating / reviewCount are 0 until the reviews table exists (AX-702).
    // The SellerProfile UI hides the rating block when there are no reviews.
    rating: 0,
    reviewCount: 0,
    year: row.year ?? DEFAULT_YEAR,
    verified: row.verified,
    stats,
    avatarColor: row.avatar_color ?? pickAvatarColor(row.id),
  };
}
