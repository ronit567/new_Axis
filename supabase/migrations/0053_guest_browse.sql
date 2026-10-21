-- Axis — 0053: guests can browse active listings; people stay private.
--
-- App Review rejected the build under Guideline 5.1.1(v): "the app requires
-- users to register before accessing products". Seeing what is for sale is not
-- an account-based feature, so it has to work signed out. Saving, messaging,
-- posting, reporting and seeing who is selling stay behind sign-in — the app
-- gates those, and none of their tables gain anything here.
--
-- 0034 closed anon reads on profiles and listings because the anon key ships
-- in the JS bundle, and the old policies let anyone who extracted it enumerate
-- every student's name, program, year and photo. That reasoning still holds
-- for profiles, and this migration leaves profiles exactly as 0034 left them.
-- What changes is listings, and only partly:
--
--   * rows: active listings only. Sold ones stay visible to their seller and
--     nobody else, as before. There is no block filtering for anon, because a
--     block needs an identity on both sides to mean anything.
--   * columns: everything a buyer needs to judge the item, EXCEPT seller_id.
--     Without it a guest cannot group listings by person or line a listing up
--     against a seller. The column grant is what enforces that, not the
--     client's select list: as anon, `select=*` or any filter on seller_id
--     fails with 42501 before a row is read.
--
-- The photos were already public — listing-images is a public bucket (0014,
-- kept public on purpose by 0039) — so what this adds is the text that goes
-- with them: title, description, price, condition, category, pickup spot,
-- view count and posting time.
--
-- anon gains no write, no function and no other table. is_blocked() and
-- private.blocked_counterparts() stay authenticated-only; the policy below
-- calls neither.
--
-- Idempotent. Apply after 0034, 0040 and 0048, and BEFORE shipping a build with
-- guest browsing: until it is applied, the guest feed fails at the grant and
-- shows its error state.

drop policy if exists "listings_select_guest" on public.listings;
create policy "listings_select_guest"
  on public.listings for select
  to anon
  using (status = 'active');

-- Keep in step with GUEST_LISTING_COLUMNS in src/repositories/mappers.ts.
-- Granting a column the client does not select is harmless; selecting one that
-- is not granted fails every guest read.
grant select (
  id,
  title,
  description,
  price,
  is_free,
  is_trade,
  condition,
  category,
  pickup,
  image_urls,
  thumb_urls,
  status,
  views,
  created_at
) on public.listings to anon;
