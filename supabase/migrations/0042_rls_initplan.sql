-- Axis — 0042: stop re-evaluating auth.uid() once per row.
--
-- The Supabase advisor reports auth_rls_initplan against 31 policies: every
-- policy in the public schema that calls auth.uid() calls it per row, so a
-- 500-row listing page evaluates it 500 times instead of once.
--
-- The fix is the documented one — wrap the call in a scalar subquery. Postgres
-- then hoists `(select auth.uid())` into an InitPlan, evaluates it once per
-- statement, and reuses the result for every row. auth.uid() is STABLE, so its
-- value cannot change within a statement and the hoist is always safe.
--
-- THIS IS A PERFORMANCE CHANGE ONLY. No policy gains or loses a single row.
--
-- That claim is worth more than an assertion, so it was mechanically checked
-- rather than eyeballed. Every expression below was read out of pg_policies on
-- production and transformed by exactly one rule: the literal text `auth.uid()`
-- becomes `(select auth.uid())`. Reversing that rule on the generated output
-- reproduces the original expression byte for byte for all 31 policies — so
-- nothing but the wrapping differs. The pre-transform snapshot also confirmed
-- the set is uniform: all 31 are PERMISSIVE, all are scoped `to authenticated`,
-- and none is a FOR ALL policy.
--
-- Deliberately NOT touched: the 9 policies on storage.objects. They also call
-- auth.uid(), but the advisor does not flag them (31 findings, 31 public
-- policies, 40 including storage), one of them is the RESTRICTIVE guard from
-- 0014, and the storage schema is Supabase-owned. Leaving them costs nothing
-- here — they are evaluated per object in a bucket listing, not per row of a
-- feed.
--
-- Each policy is dropped and recreated. Migrations run inside a transaction,
-- so there is no window in which a table sits unprotected: either every policy
-- is replaced or none is.
--
-- One further mechanical rule beyond the wrapping: pg_policies renders function
-- calls unqualified (`is_blocked(...)`) because public sits in search_path, so
-- the 6 such references are written back as `public.is_blocked(...)`. Creation
-- then does not depend on whatever search_path happens to be active. Reversing
-- BOTH rules still reproduces all 31 original expressions exactly.
--
-- Apply after 0002 (and after every migration that adds a policy: 0011, 0015,
-- 0019, 0020, 0021, 0034).


-- ── blocks ────────────────────────────────────────────────────
drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own"
  on public.blocks for delete
  to authenticated
  using (((select auth.uid()) = blocker_id));

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own"
  on public.blocks for insert
  to authenticated
  with check ((((select auth.uid()) = blocker_id) AND (blocker_id <> blocked_id)));

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own"
  on public.blocks for select
  to authenticated
  using (((select auth.uid()) = blocker_id));


-- ── follows ───────────────────────────────────────────────────
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (((select auth.uid()) = follower_id));

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check ((((select auth.uid()) = follower_id) AND (NOT public.is_blocked(follower_id, followee_id))));

drop policy if exists "follows_select_own" on public.follows;
create policy "follows_select_own"
  on public.follows for select
  to authenticated
  using (((select auth.uid()) = follower_id));


-- ── listing_edit_requests ─────────────────────────────────────
drop policy if exists "listing_edit_requests_insert_own" on public.listing_edit_requests;
create policy "listing_edit_requests_insert_own"
  on public.listing_edit_requests for insert
  to authenticated
  with check ((((select auth.uid()) = requester_id) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_edit_requests.listing_id) AND (l.seller_id = (select auth.uid())))))));

drop policy if exists "listing_edit_requests_select_own" on public.listing_edit_requests;
create policy "listing_edit_requests_select_own"
  on public.listing_edit_requests for select
  to authenticated
  using (((select auth.uid()) = requester_id));


-- ── listings ──────────────────────────────────────────────────
drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings for delete
  to authenticated
  using (((select auth.uid()) = seller_id));

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (((select auth.uid()) = seller_id));

drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings for select
  to authenticated
  using ((((select auth.uid()) = seller_id) OR ((status = 'active'::text) AND (NOT public.is_blocked((select auth.uid()), seller_id)))));

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using (((select auth.uid()) = seller_id))
  with check (((select auth.uid()) = seller_id));


-- ── messages ──────────────────────────────────────────────────
drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender"
  on public.messages for delete
  to authenticated
  using (((select auth.uid()) = sender_id));

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check ((((select auth.uid()) = sender_id) AND (sender_id <> receiver_id) AND (NOT public.is_blocked(sender_id, receiver_id))));

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)));

drop policy if exists "messages_update_receiver_read" on public.messages;
create policy "messages_update_receiver_read"
  on public.messages for update
  to authenticated
  using (((select auth.uid()) = receiver_id))
  with check (((select auth.uid()) = receiver_id));


-- ── notifications ─────────────────────────────────────────────
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));


-- ── profiles ──────────────────────────────────────────────────
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (((select auth.uid()) = id));

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  to authenticated
  using (((id = (select auth.uid())) OR (NOT public.is_blocked((select auth.uid()), id))));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (((select auth.uid()) = id))
  with check (((select auth.uid()) = id));


-- ── reports ───────────────────────────────────────────────────
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (((select auth.uid()) = reporter_id));


-- ── reviews ───────────────────────────────────────────────────
drop policy if exists "reviews_delete_reviewer" on public.reviews;
create policy "reviews_delete_reviewer"
  on public.reviews for delete
  to authenticated
  using (((select auth.uid()) = reviewer_id));

drop policy if exists "reviews_insert_reviewer" on public.reviews;
create policy "reviews_insert_reviewer"
  on public.reviews for insert
  to authenticated
  with check ((((select auth.uid()) = reviewer_id) AND (reviewer_id <> seller_id) AND (NOT public.is_blocked(reviewer_id, seller_id)) AND (EXISTS ( SELECT 1
   FROM messages m
  WHERE (((m.sender_id = (select auth.uid())) AND (m.receiver_id = reviews.seller_id)) OR ((m.sender_id = reviews.seller_id) AND (m.receiver_id = (select auth.uid()))))))));

drop policy if exists "reviews_select_authenticated" on public.reviews;
create policy "reviews_select_authenticated"
  on public.reviews for select
  to authenticated
  using ((((select auth.uid()) = reviewer_id) OR ((select auth.uid()) = seller_id) OR (NOT public.is_blocked((select auth.uid()), reviewer_id))));

drop policy if exists "reviews_update_reviewer" on public.reviews;
create policy "reviews_update_reviewer"
  on public.reviews for update
  to authenticated
  using (((select auth.uid()) = reviewer_id))
  with check (((select auth.uid()) = reviewer_id));


-- ── saved_listings ────────────────────────────────────────────
drop policy if exists "saved_delete_own" on public.saved_listings;
create policy "saved_delete_own"
  on public.saved_listings for delete
  to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "saved_insert_own" on public.saved_listings;
create policy "saved_insert_own"
  on public.saved_listings for insert
  to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "saved_select_own" on public.saved_listings;
create policy "saved_select_own"
  on public.saved_listings for select
  to authenticated
  using (((select auth.uid()) = user_id));


-- ---------------------------------------------------------------------------
-- Verification. Run after applying.
--
--   -- 1. Still 31 policies, still all calling auth.uid(), now all wrapped.
--   select count(*) filter (where qual like '%auth.uid()%'
--                              or with_check like '%auth.uid()%') as referencing,
--          count(*) filter (where qual like '%( SELECT auth.uid()%'
--                              or with_check like '%( SELECT auth.uid()%') as wrapped
--   from pg_policies where schemaname = 'public';
--   -- expect: referencing = 31, wrapped = 31
--
--   -- 2. Nothing became permissive-by-accident or lost its role scoping.
--   select distinct permissive, roles::text, cmd
--   from pg_policies where schemaname = 'public';
--   -- expect: PERMISSIVE / {authenticated} only
--
--   -- 3. The advisor should now report zero auth_rls_initplan findings:
--   --      supabase db advisors --linked
--
-- And the real check: run supabase/tests/rls_policies_test.sql against a local
-- stack before pushing this to production. It covers owner vs non-owner vs anon
-- vs blocked across the tables these policies protect, which is exactly the
-- behaviour this migration must not change.
-- ---------------------------------------------------------------------------
