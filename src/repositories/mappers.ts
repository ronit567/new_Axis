// The keystone mapping layer (AX-110): DB rows -> domain types.
//
// This is the ONE place the type <-> DB mismatch documented in PROJECT_ROADMAP.md
// is reconciled — seller joins, `created_at` -> "3d ago", the saved-listings join,
// and image/color placeholders. Repositories call these; screens never map.
// Keep all mapping logic here so no screen reinvents it.

import type {
  Contact,
  Conversation,
  Listing,
  Message,
  MyListing,
  Notification,
  NotificationType,
  Review,
  Seller,
  SellerProfile,
} from '../types';
import type {
  ListingRow,
  MessageRow,
  NotificationRow,
  ProfileRow,
  ReviewRow,
} from '../types/database';
import { timeAgo } from '../lib/timeAgo';

// --- Deterministic placeholder palettes -------------------------------------
// These reproduce the pastel card backgrounds and avatar colors from the mock so
// skeletons/placeholders look identical after migrating to live data. Real
// images (AX-402) render on top of these fallbacks; avatar uploads (AX-403)
// will do the same.
const IMAGE_COLORS = ['#E8E0F5', '#E4ECF8', '#EBE4F8', '#F0E8F8', '#E8ECF0', '#EDE8F8'] as const;
const AVATAR_COLORS = ['#5C2D91', '#7B4BB0', '#8E5DC4', '#6B3AA0', '#4C2478'] as const;

// dotColor is an "online" presence indicator, but there is no realtime presence
// system yet. Rather than imply everyone is online (green), default to a neutral
// muted grey meaning "presence unknown". Swap when presence lands.
const DEFAULT_DOT_COLOR = '#9E9EAE';

// Fallbacks for NOT-NULL-in-the-UI fields that are nullable in the DB.
// (`year` has no fallback: null is meaningful — it's a grad student — so the
// mappers surface it as the 'Grad' sentinel rather than fabricating a year.)
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
    // null year => grad student; surface the 'Grad' sentinel, don't coerce to 1.
    year: row.year ?? 'Grad',
    location: row.location ?? '',
    program: row.program ?? '',
    dotColor: DEFAULT_DOT_COLOR,
    avatarUrl: row.avatar_url,
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
    // imageColor is always a deterministic placeholder color, rendered as the
    // loading/empty fallback behind imageUrls (AX-402). Empty image_urls =>
    // this is all the card shows, so it must stay stable per id.
    imageColor: pickImageColor(row.id),
    imageUrls: row.image_urls,
    // No `badge` column exists in the schema yet (the mock's "Price ↓" was
    // fabricated). Always null until a badge/price-history feature is designed.
    badge: null,
    description: row.description ?? '',
    views: row.views,
    postedAgo: timeAgo(row.created_at),
    pickup: row.pickup ?? '',
  };
}

// ManageListingsScreen's own-listings view. `saves` is aggregated by the
// caller (a count across saved_listings, same batch-join shape as toListing's
// isSaved) rather than read off the row, since it isn't a column.
export function toMyListing(row: ListingRow, saves: number): MyListing {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    status: row.status === 'sold' ? 'sold' : 'active',
    category: row.category ?? DEFAULT_CATEGORY,
    views: row.views,
    saves,
    postedAgo: timeAgo(row.created_at),
    imageColor: pickImageColor(row.id),
    // No separate "sale price" column — a sold listing keeps its list price.
    soldFor: row.status === 'sold' ? row.price : undefined,
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
    location: row.location ?? '',
    bio: row.bio ?? '',
    joinedDate: formatJoinedDate(row.created_at),
    // rating / reviewCount are 0 until the reviews table exists (AX-702).
    // The SellerProfile UI hides the rating block when there are no reviews.
    rating: 0,
    reviewCount: 0,
    // null year => grad student; surface the 'Grad' sentinel, don't coerce to 1.
    year: row.year ?? 'Grad',
    verified: row.verified,
    stats,
    avatarColor: row.avatar_color ?? pickAvatarColor(row.id),
    avatarUrl: row.avatar_url,
  };
}

// --- Reviews (0020) -----------------------------------------------------------

// `reviewer` is non-null by contract: ReviewRepository drops rows whose
// reviewer profile is RLS-hidden before mapping (same convention as
// NotificationRepository dropping actorless notifications).
export function toReview(row: ReviewRow, reviewer: ProfileRow): Review {
  return {
    id: row.id,
    sellerId: row.seller_id,
    reviewer: toContact(reviewer),
    rating: row.rating,
    body: row.body,
    timeAgo: timeAgo(row.created_at),
  };
}

// --- Messaging (AX-113) ------------------------------------------------------

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    listingId: row.listing_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

// Chat-header display info from a full profile row (conversations list path).
export function toContact(row: ProfileRow): Contact {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials ?? deriveInitials(row.name),
    avatarColor: row.avatar_color ?? pickAvatarColor(row.id),
    avatarUrl: row.avatar_url,
  };
}

// Same, from a Listing's nested Seller (ListingDetail "Message" entry point,
// where no profile row is in hand). Seller doesn't carry initials/avatar_color,
// so both fall back to the derived/deterministic values — the id-seeded palette
// keeps the color stable across screens for profiles that never set one.
export function sellerToContact(seller: Seller): Contact {
  return {
    id: seller.id,
    name: seller.name,
    initials: deriveInitials(seller.name),
    avatarColor: pickAvatarColor(seller.id),
    avatarUrl: seller.avatarUrl,
  };
}

type ConversationParts = {
  partner: ProfileRow;
  // Null when the listing row is gone or RLS-hidden; the thread still renders.
  listing: ListingRow | null;
  lastMessage: MessageRow;
  unreadCount: number;
  currentUserId: string;
};

export function toConversation(parts: ConversationParts): Conversation {
  const { partner, listing, lastMessage, unreadCount, currentUserId } = parts;
  return {
    partnerId: partner.id,
    partner: toContact(partner),
    listingId: lastMessage.listing_id,
    listingTitle: listing?.title ?? null,
    listingPrice: listing?.price ?? null,
    lastMessage: lastMessage.body,
    lastMessageAt: timeAgo(lastMessage.created_at),
    unreadCount,
    // "Selling" = the thread is about my listing. Without a visible listing row
    // we can't tell, so default to Buying (the common buyer-initiated case).
    type: listing && listing.seller_id === currentUserId ? 'Selling' : 'Buying',
  };
}

// --- Notifications (AX-601/602) ---------------------------------------------

type NotificationParts = {
  row: NotificationRow;
  // null => actor RLS-hidden (blocked); the repository drops these rows before
  // they reach this mapper.
  actor: ProfileRow | null;
  listing: ListingRow | null;
};

export function toNotification(parts: NotificationParts): Notification {
  const { row, actor, listing } = parts;
  const actorName = actor?.name ?? 'Someone';
  const title = listing?.title ?? null;
  const message =
    row.type === 'message'
      ? title
        ? `${actorName} sent you a message about "${title}"`
        : `${actorName} sent you a message`
      : title
        ? `${actorName} saved your listing "${title}"`
        : `${actorName} saved your listing`;
  return {
    id: row.id,
    type: row.type as NotificationType,
    actor: actor ? toContact(actor) : null,
    actorId: row.actor_id,
    listingId: row.listing_id,
    listingTitle: title,
    listingPrice: listing?.price ?? null,
    message,
    timeAgo: timeAgo(row.created_at),
    createdAt: row.created_at,
    read: row.read,
  };
}
