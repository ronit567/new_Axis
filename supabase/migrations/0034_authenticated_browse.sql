-- Axis — 0034: browsing requires authentication; anon loses profiles/listings.
--
-- 0002 granted profiles/listings SELECT to anon for signed-out browsing that
-- the app never shipped (every browse surface sits behind the session gate in
-- App.tsx). Meanwhile the anon key is inlined in the JS bundle by design, so
-- the policy as written let anyone who extracted it enumerate every student's
-- name/program/year/photo — the exact trade-off 0002's PRIVACY NOTE flagged.
--
-- In practice anon reads already hard-failed at parse time (no EXECUTE on
-- is_blocked(), which both policy expressions reference — see the RLS tests'
-- scenario 5), but that protection was a side effect of a function grant, not
-- stated intent. This makes it intent: policies scoped to authenticated, anon
-- table grants revoked, and the CASE short-circuits that only existed to
-- shield anon from is_blocked() removed.
--
-- Also codifies dropping the two rogue USING (true) policies the production
-- audit found live in prod (dashboard-created, never in a migration) — they
-- OR-bypass the block filtering below, and dropping them here keeps the drift
-- from recurring.

-- ── rogue prod policies (no-ops where they never existed) ──
drop policy if exists "listings_select_authenticated" on public.listings;
drop policy if exists "profiles_select_authenticated" on public.profiles;

-- ── profiles ──
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or not public.is_blocked(auth.uid(), id)
  );

-- ── listings ──
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings for select
  to authenticated
  using (
    auth.uid() = seller_id
    or (
      status = 'active'
      and not public.is_blocked(auth.uid(), seller_id)
    )
  );

-- ── grants: anon keeps schema usage (harmless) but loses both table reads,
--    so an anon SELECT now fails at the grant, not as an is_blocked side
--    effect. authenticated grants are unchanged from 0005. ──
revoke select on public.profiles from anon;
revoke select on public.listings from anon;
