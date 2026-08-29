-- Axis — 0027: lock browsing behind authentication.
--
-- 0002 made profiles and active listings readable by `anon` so the app could
-- support signed-out browsing. That feature is not wanted: Axis is a closed
-- marketplace for verified Western students, and the anon-readable policies
-- exposed student names, programs, and year of study to any caller holding
-- the (publicly shipped) anon key.
--
-- Note this was ALREADY failing in practice, but by accident rather than by
-- design: `is_blocked()` is granted only to `authenticated`, so an anon select
-- died with "permission denied for function is_blocked" instead of returning
-- rows. That is a fragile way to enforce a product decision — granting anon
-- EXECUTE on is_blocked (an obvious-looking fix for that confusing error)
-- would have silently re-opened public browsing. This migration makes the
-- closure explicit at the policy level, so it can't be undone by accident.
--
-- Follows the path 0002's own comment describes: change the two _select_
-- policies from `to anon, authenticated` to `to authenticated`.

-- ---------------------------------------------------------------------------
-- profiles: readable only by signed-in users, still hiding blocked parties.
--
-- The `case when auth.uid() is null` guard from 0002 is gone: it existed only
-- to stop anon callers reaching is_blocked(), and anon can no longer match
-- this policy at all. An explicit `auth.uid() is not null` guard replaces it
-- so the predicate fails CLOSED if auth.uid() is ever null for a role that
-- somehow reaches here — without it, is_blocked(null, id) returns false and
-- `not false` would expose every row.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_public" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() is not null
    and (
      id = auth.uid()
      or not public.is_blocked(auth.uid(), id)
    )
  );

-- ---------------------------------------------------------------------------
-- listings: same treatment. Sellers still see their own listings in any
-- status; everyone else sees active, non-blocked listings only.
-- ---------------------------------------------------------------------------
drop policy if exists "listings_select_public" on public.listings;

create policy "listings_select_authenticated"
  on public.listings for select
  to authenticated
  using (
    auth.uid() is not null
    and (
      auth.uid() = seller_id
      or (
        status = 'active'
        and not public.is_blocked(auth.uid(), seller_id)
      )
    )
  );
