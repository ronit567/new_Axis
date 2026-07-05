export type Seller = {
  id: string;
  name: string;
  year: number;
  location: string;
  program: string;
  dotColor: string;
};

export type SellerProfile = {
  id: string;
  name: string;
  initials: string;
  program: string;
  bio: string;
  joinedDate: string;
  rating: number;
  reviewCount: number;
  year: number;
  verified: boolean;
  stats: { listings: number; sold: number; replyTime: string };
  avatarColor: string;
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
  badge: string | null;
  description: string;
  views: number;
  postedAgo: string;
  pickup: string;
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
  Search: undefined;
  ListingDetail: { listingId: string };
  SellerProfile: { seller: SellerProfile };
  CreateListing: undefined;
  Messages: undefined;
  Chat: { listing?: Listing; contact?: Contact };
  Notifications: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  CommunityGuidelines: undefined;
};
