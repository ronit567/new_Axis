-- Axis — 0022: performance indexes for the listing feed and search.
--
-- Every hot read path orders listings by created_at desc:
--   - ListingRepository.getAll  → status = 'active' order created_at desc
--   - ListingRepository.search  → status = 'active' + ILIKE order created_at desc
--   - getBySeller/getActiveBySeller → seller_id = ? order created_at desc
-- 0001 indexed seller_id / category / status individually but nothing covers
-- the sort, so these queries sort after a scan.
--
-- At the current row count (~hundreds) the planner will still — correctly —
-- choose seq scans over these indexes. They exist so the feed and search do
-- not degrade as the listings table grows; they are insurance, not a fix for
-- a problem visible today.

-- Feed + search: partial index matching the exact hot predicate. Partial on
-- status = 'active' keeps sold/removed rows out of the index entirely.
create index if not exists listings_active_created_at_idx
  on public.listings (created_at desc)
  where status = 'active';

-- Storefront / Manage Listings: a seller's rows in feed order.
create index if not exists listings_seller_created_at_idx
  on public.listings (seller_id, created_at desc);

-- Search uses leading-wildcard ILIKE ('%q%') on title and description, which
-- a btree can never serve. pg_trgm GIN indexes accelerate that exact query
-- unchanged — substring semantics are preserved and no app code changes.
-- (Full-text search was considered and rejected: word/stem matching would
-- change search behaviour and require a tsvector column + query rewrite.)
create extension if not exists pg_trgm with schema extensions;

create index if not exists listings_title_trgm_idx
  on public.listings using gin (title extensions.gin_trgm_ops);

create index if not exists listings_description_trgm_idx
  on public.listings using gin (description extensions.gin_trgm_ops);
