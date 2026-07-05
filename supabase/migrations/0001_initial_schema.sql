-- Axis — Phase 2 initial schema (DRAFT — review before applying)
-- Tables mirror src/types/index.ts and the "Database Tables" plan in AI_context.md.
-- RLS is enabled here but the policies live in 0002_rls_policies.sql.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. id == auth.users.id.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null,
  initials      text,
  program       text,
  year          integer,
  location      text,
  avatar_url    text,
  avatar_color  text,
  -- `verified` is kept to match the SellerProfile type, but the "Western
  -- verified" UI was removed (commit 013c3d8) — treat as unused for now.
  verified      boolean not null default false,
  reply_time    text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text,
  price        numeric(10, 2) not null default 0,
  is_free      boolean not null default false,
  is_trade     boolean not null default false,
  -- condition is optional (free/trade items may omit it).
  condition    text check (condition in ('Like new', 'Good', 'Fair')),
  -- NOTE: no CHECK on category on purpose — the canonical category list is an
  -- open decision (Home vs CreateListing mismatch, see AI_context Known Issues).
  category     text,
  pickup       text,
  image_urls   text[] not null default '{}',
  status       text not null default 'active' check (status in ('active', 'sold')),
  views        integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists listings_seller_id_idx on public.listings (seller_id);
create index if not exists listings_category_idx  on public.listings (category);
create index if not exists listings_status_idx    on public.listings (status);

-- ---------------------------------------------------------------------------
-- saved_listings: per-user saved join table (composite PK)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_listings (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists saved_listings_listing_id_idx on public.saved_listings (listing_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid references public.listings (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists messages_listing_id_idx  on public.messages (listing_id);
create index if not exists messages_receiver_id_idx on public.messages (receiver_id);
create index if not exists messages_sender_id_idx   on public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         text not null,
  listing_id   uuid references public.listings (id) on delete set null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

-- ---------------------------------------------------------------------------
-- blocks: directed "blocker_id blocked blocked_id". The row is directed, but
-- for *visibility* the relationship is treated as mutual — see is_blocked()
-- in 0002, which hides content in both directions. Backs AX-703 (report/block)
-- and is enforced at the query layer by the listings/messages RLS policies.
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

-- Reverse-direction lookups (who blocked me?) for is_blocked().
create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

-- Enable RLS on every table (policies added in 0002). With RLS on and no
-- policy, access is denied by default — safe until 0002 runs.
alter table public.profiles       enable row level security;
alter table public.listings       enable row level security;
alter table public.saved_listings enable row level security;
alter table public.messages       enable row level security;
alter table public.notifications  enable row level security;
alter table public.blocks         enable row level security;
