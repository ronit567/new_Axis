// A student's year of study. Grad students have no numeric year — SetupProfile
// stores null for them, and the mappers surface that null as the 'Grad' sentinel
// the year picker already uses. Kept out of plain `number` so the Grad/Year-1
// distinction survives the DB round-trip: a Grad profile must not read back as
// "Year 1" (previously it did, silently downgrading grads on edit).
export type YearOfStudy = number | 'Grad';

export type Seller = {
  id: string;
  name: string;
  year: YearOfStudy;
  location: string;
  program: string;
  dotColor: string;
  // Public storage URL of the uploaded profile photo; null renders the
  // initials + avatarColor fallback.
  avatarUrl: string | null;
};

export type SellerProfile = {
  id: string;
  name: string;
  initials: string;
  program: string;
  location: string;
  bio: string;
  joinedDate: string;
  year: YearOfStudy;
  verified: boolean;
  stats: { listings: number; sold: number; replyTime: string };
  avatarColor: string;
  avatarUrl: string | null;
};

// The finite set of condition values the UI offers (create-listing form,
// search filters) — domain-level, not derived from the DB schema, so screens
// and hooks can depend on it without reaching into src/types/database.
export type ListingCondition = 'Like new' | 'Good' | 'Fair';

export type Listing = {
  id: string;
  title: string;
  price: number;
  condition: string;
  category: string;
  seller: Seller;
  saved: boolean;
  imageColor: string;
  // Public storage URLs in upload order (the ~1600px detail variants).
  // Empty when the listing has no photos — screens fall back to imageColor.
  imageUrls: string[];
  // Grid-sized variants, index-parallel to imageUrls. The mapper guarantees
  // thumbUrls[i] falls back to imageUrls[i] for rows without thumbs (0023).
  thumbUrls: string[];
  badge: string | null;
  description: string;
  views: number;
  postedAgo: string;
  pickup: string;
  // Rendered through lib/formatPrice everywhere a price is shown — a Free or
  // Trade listing stores price 0, so printing the raw number reads as "$0".
  isFree: boolean;
  isTrade: boolean;
  // 0021: ListingDetailScreen's owner view needs this to choose between
  // "Mark sold" and "Relist" — MyListing already carried status, but the
  // single-listing Listing type never had to before the owner view existed.
  status: 'active' | 'sold';
};

export type MyListing = {
  id: string;
  title: string;
  price: number;
  status: 'active' | 'sold';
  category: string;
  views: number;
  saves: number;
  postedAgo: string;
  imageColor: string;
  // Public storage URLs in upload order (the ~1600px detail variants).
  // Empty when the listing has no photos — screens fall back to imageColor.
  imageUrls: string[];
  // Grid-sized variants, index-parallel to imageUrls (0023 fallback applies).
  thumbUrls: string[];
  soldFor?: number;
  // The owner's own views (Manage listings, Profile grid) show prices too, so
  // they need the same Free/Trade flags the buyer-facing Listing carries.
  isFree: boolean;
  isTrade: boolean;
};

export type Contact = {
  // The conversation partner's user id. Optional while screens still run on mock
  // data; the real getConversations() populates it so a Contact can round-trip
  // into getMessages(partnerId) / a reply to a specific person.
  id?: string;
  initials: string;
  avatarColor: string;
  name: string;
  // Optional so Contact literals built without a profile row in hand stay
  // valid; absent/null renders the initials fallback.
  avatarUrl?: string | null;
};

export type NotificationType = 'message' | 'listing_saved' | 'listing_edited';

export type Notification = {
  id: string;
  type: NotificationType;
  // The user who triggered it (message sender / listing saver). Both current
  // triggers always set an actor; null is reserved for future system notifs.
  actor: Contact | null;
  actorId: string | null;
  listingId: string | null;
  listingTitle: string | null;
  listingPrice: number | null;
  // Display copy composed by the mapper, e.g. 'Aria saved your listing "…"'.
  message: string;
  timeAgo: string;
  // Raw ISO timestamp, for Today/Earlier bucketing on the screen.
  createdAt: string;
  read: boolean;
};

export type Message = {
  id: string;
  listingId: string | null;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string; // ISO — screens format for display
  readAt: string | null; // null = the receiver hasn't opened it yet
};

// One row in the Messages inbox. Identity is the (listing, partner) pair
// (0051, superseding 0026's per-partner grouping): messaging one person about
// two listings is two threads. listingId is the thread's subject, not just the
// newest message's context, so it is what the row is labelled with — the
// partner's name is secondary here and only becomes the headline in the chat
// itself. A null listingId is the listing-less bucket: a chat opened without
// listing context, or one whose listing has since been deleted (0051's FK
// nulls it rather than deleting the messages).
export type Conversation = {
  partnerId: string;
  partner: Contact;
  listingId: string | null;
  // Null when the listing is gone or RLS-hidden (e.g. sold and not ours);
  // the conversation itself stays visible.
  listingTitle: string | null;
  listingPrice: number | null;
  // Grid-sized photo for the row's thumbnail (0023's thumb, falling back to
  // the full-res first image). Null when the listing has no photos, is gone,
  // or the thread has no listing at all.
  listingThumbUrl: string | null;
  // Deterministic placeholder behind/instead of the thumbnail, from the same
  // id-seeded palette the listing cards use — derived from the listing id, so
  // it is present even when the listing row itself is not. Null only for a
  // thread with no listing.
  listingImageColor: string | null;
  lastMessage: string;
  lastMessageAt: string; // relative label via timeAgo ("2m ago")
  unreadCount: number;
  // 'Selling' when the thread is about the current user's own listing.
  type: 'Buying' | 'Selling';
};

// AX-703: report + block. ReportTarget mirrors the ReportModal UI's entry
// points (listing detail, seller profile, chat); ReportReason is the finite
// list its reason picker offers. Single source of truth for both the component
// and ReportRepository, so they can't drift. Kept in step with
// reports_target_type_check.
export type ReportTarget = 'listing' | 'user' | 'chat';
export type ReportReason = 'spam' | 'prohibited_item' | 'harassment' | 'other';

// One row on the Blocked users screen (migration 0033's my_blocked_users()).
// Display info only — the id is what unblocking needs.
export type BlockedUser = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  avatarColor: string;
};

// A pending (or resolved) proposal to change one of the scam-vector fields
// (title/category/condition/photos) on a listing that already has outside
// interest — see migration 0021. A null proposed* means "no change proposed
// for this field"; proposedImageUrls, when set, is the complete desired
// ordered array (not a delta).
export type ListingEditRequest = {
  id: string;
  listingId: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedTitle: string | null;
  proposedCategory: string | null;
  proposedCondition: string | null;
  proposedImageUrls: string[] | null;
  createdAt: string;
};

export type RootStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  SetupProfile: undefined;
  Profile: undefined;
  EditProfile: undefined;
  ManageListings: undefined;
  Settings: undefined;
  Main: undefined;
  // showFilters opens the screen with the filter sheet already up (the Home
  // header's filter button) instead of the keyboard-focused search state.
  Search: { showFilters?: boolean } | undefined;
  ListingDetail: { listingId: string };
  SellerProfile: { seller: SellerProfile };
  CreateListing: undefined;
  EditListing: { listingId: string };
  Messages: undefined;
  // IDs drive the data; `partner` is display info so the header renders before
  // any fetch. listingId is half the thread's identity (0051), not just banner
  // context: it selects which conversation with this person to load, so the
  // same partner with a different listingId is a different thread.
  // listingTitle/listingPrice/listingThumbUrl feed the banner, and a present
  // title also enables the "View" round-trip (ListingDetail loads by id).
  // `draftMessage` pre-fills the composer — e.g. the listing detail "Make offer"
  // shortcut drops in an offer template so buyers negotiate over chat.
  // `draftNonce` changes on every navigation so re-targeting an already-mounted
  // Chat with the *same* draft string still re-seeds the composer.
  Chat: {
    listingId: string | null;
    partnerId: string;
    partner: Contact;
    listingTitle?: string;
    listingPrice?: number;
    listingThumbUrl?: string;
    draftMessage?: string;
    draftNonce?: number;
  };
  Notifications: undefined;
  BlockedUsers: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  CommunityGuidelines: undefined;
};
