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
  rating: number;
  reviewCount: number;
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
  // Public storage URLs in upload order; imageUrls[0] is the card thumbnail.
  // Empty when the listing has no photos — screens fall back to imageColor.
  imageUrls: string[];
  badge: string | null;
  description: string;
  views: number;
  postedAgo: string;
  pickup: string;
  // 0021: EditListingScreen needs these to prefill the low-risk Free/Trade
  // toggles — no other screen surfaced them before this (there's no
  // Free/Trade badge on ListingDetail yet).
  isFree: boolean;
  isTrade: boolean;
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
  soldFor?: number;
};

export type Contact = {
  // The conversation partner's user id. Optional while screens still run on mock
  // data; the real getConversations() populates it so a Contact can round-trip
  // into getMessages(listingId, partnerId) / a reply to a specific person.
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

// One row in the Messages inbox. Identity is (listingId, partnerId) — the same
// two people can have separate threads about different listings.
export type Conversation = {
  partnerId: string;
  partner: Contact;
  listingId: string | null;
  // Null when the listing is gone or RLS-hidden (e.g. sold and not ours);
  // the conversation itself stays visible.
  listingTitle: string | null;
  listingPrice: number | null;
  lastMessage: string;
  lastMessageAt: string; // relative label via timeAgo ("2m ago")
  unreadCount: number;
  // 'Selling' when the thread is about the current user's own listing.
  type: 'Buying' | 'Selling';
};

// AX-703: report + block. ReportTarget mirrors the ReportModal UI's three
// entry points (listing detail, seller profile, chat); ReportReason is the
// finite list its reason picker offers. Single source of truth for both the
// component and ReportRepository, so they can't drift.
export type ReportTarget = 'listing' | 'user' | 'chat';
export type ReportReason = 'spam' | 'prohibited_item' | 'harassment' | 'other';

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
  VerifyEmail: { email?: string };
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
  // any fetch. listingTitle/listingPrice feed the banner, and a present title
  // also enables the "View" round-trip (ListingDetail loads by id).
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
    draftMessage?: string;
    draftNonce?: number;
  };
  Notifications: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  CommunityGuidelines: undefined;
};
