// DB row types for the Axis Postgres schema.
//
// ⚠️ HAND-WRITTEN from supabase/migrations/0001_initial_schema.sql.
// These are a stopgap so the mapper/repository layer can be typed before the
// Supabase project is provisioned. They are to be REPLACED wholesale by
//   `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
// under ticket AX-102 once the schema is applied to a live project.
//
// Conventions matched to what `supabase gen types` produces for a "Row":
//   - uuid        -> string
//   - text        -> string (nullable columns -> string | null)
//   - integer     -> number
//   - numeric     -> number
//   - boolean     -> boolean
//   - timestamptz -> string  (ISO 8601)
//   - text[]      -> string[]
// A column is `| null` here iff the SQL column has no NOT NULL constraint.
// (Columns with a DEFAULT but also NOT NULL — e.g. `verified`, `views`,
// `image_urls`, `status` — are non-null in a Row.)
//
// Boundary rule (AX-102): only repositories/mappers import these types. Screens
// and hooks speak the domain types in src/types/index.ts, never row types.

// profiles: one row per auth user. id == auth.users.id.
export type ProfileRow = {
  id: string;
  name: string;
  initials: string | null;
  program: string | null;
  year: number | null;
  location: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  verified: boolean;
  reply_time: string | null;
  created_at: string;
};

export type ListingCondition = 'Like new' | 'Good' | 'Fair';
export type ListingStatus = 'active' | 'sold';

// listings. `condition` is CHECK-constrained but nullable (free/trade items may
// omit it); `status` is CHECK-constrained and NOT NULL.
export type ListingRow = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  is_free: boolean;
  is_trade: boolean;
  condition: ListingCondition | null;
  category: string | null;
  pickup: string | null;
  image_urls: string[];
  status: ListingStatus;
  views: number;
  created_at: string;
};

// saved_listings: per-user saved join table (composite PK user_id + listing_id).
export type SavedListingRow = {
  user_id: string;
  listing_id: string;
  created_at: string;
};

// messages. listing_id is nullable (ON DELETE CASCADE, but the FK is optional).
export type MessageRow = {
  id: string;
  listing_id: string | null;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

// notifications. Present in the schema; included for completeness even though no
// mapper consumes it yet (notification wiring is Epic 6 / AX-60x).
export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  listing_id: string | null;
  read: boolean;
  created_at: string;
};
