-- Axis — 0049: index the foreign keys deletes cascade through, and drop indexes
-- that are paid for on every write and can never be chosen.
--
-- Idempotent. Plain CREATE INDEX rather than CONCURRENTLY: a migration runs in a
-- transaction, where CONCURRENTLY is not allowed, and these tables hold a few
-- dozen rows today, so the build is instant. If this is ever replayed against a
-- large table, build the three indexes by hand with CONCURRENTLY first; the
-- IF NOT EXISTS below then makes this file a no-op for them.

-- ── 1. Unindexed foreign keys (performance advisor: unindexed_foreign_keys) ──
-- A foreign key is checked from the referenced side too. Deleting a profile or a
-- listing makes Postgres find every row pointing at it, to cascade or null it:
--
--   notifications.listing_id -> listings   ON DELETE SET NULL
--   notifications.actor_id   -> profiles   ON DELETE CASCADE
--   follows.followee_id      -> profiles   ON DELETE CASCADE
--
-- Without an index on the referencing column that lookup is a sequential scan
-- of the whole table, once per deleted parent row. delete_own_account() removes
-- a profile and, through it, every one of that user's listings — so closing the
-- account of a seller with 200 listings scanned all of notifications 200 times,
-- inside one RPC the user is waiting on.
--
-- follows_followee_id_idx also serves the "who follows this seller" direction;
-- the primary key is (follower_id, followee_id) and only helps the other way.

create index if not exists notifications_listing_id_idx
  on public.notifications (listing_id)
  where listing_id is not null;

create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id)
  where actor_id is not null;

create index if not exists follows_followee_id_idx
  on public.follows (followee_id);

-- ── 2. Redundant indexes ────────────────────────────────────────────────────
-- A btree on (a, b) answers every question a btree on (a) can, including
-- backing the foreign key on `a`. Each of these is the leading column of a
-- composite added later, and 0036 says as much about two of them ("the existing
-- indexes are single-column ... usable, but ...") without dropping them. They
-- cost an index write on every insert into the two busiest tables — each
-- message is an insert into messages and, through its trigger, into
-- notifications — and the planner has no reason to pick them.
--
--   dropped                        superseded by
--   listings_seller_id_idx         listings_seller_created_at_idx (seller_id, created_at desc)
--   messages_sender_id_idx         messages_sender_created_idx    (sender_id, created_at desc)
--   notifications_user_id_idx      notifications_user_created_idx (user_id, created_at desc)
--   reports_reporter_id_idx        reports_reporter_created_idx   (reporter_id, created_at desc)

drop index if exists public.listings_seller_id_idx;
drop index if exists public.messages_sender_id_idx;
drop index if exists public.notifications_user_id_idx;
drop index if exists public.reports_reporter_id_idx;

-- listings.status has two values, so a btree on it alone cannot be selective
-- enough to beat a scan; the feed is served by the partial index
-- listings_active_created_at_idx (... WHERE status = 'active'), and a seller's
-- own list by listings_seller_created_at_idx. What this index does do is make
-- every mark-sold and relist a non-HOT update, because the changed column is
-- indexed.
drop index if exists public.listings_status_idx;

-- Left alone on purpose:
--   * listings_category_idx — low cardinality, but the category feed filters on
--     it and there is no measurement to justify removing it.
--   * listings_title_trgm_idx / listings_description_trgm_idx — see the PR notes:
--     under RLS the planner cannot use them for ILIKE, but fixing search
--     properly is a design change, not an index change.
--   * reports_status_idx — the moderation queue orders open-first.
