-- Axis — AX-111: atomic, any-viewer view counter for listings.
--
-- listings_update_own (0002) scopes UPDATE to `auth.uid() = seller_id`, so a
-- plain `update listings set views = views + 1 ...` from anyone but the
-- seller would silently affect 0 rows under RLS — views would never
-- increment for the people actually browsing the listing.
--
-- SECURITY DEFINER (+ pinned search_path, mirroring is_blocked() in 0002 and
-- set_profile_verified() in 0004) lets any authenticated caller bump the
-- counter while the function body itself does the one narrow thing it's
-- trusted for: increment views by exactly 1 for one row, nothing broader.
-- The `views = views + 1` runs as a single statement, so it's atomic —
-- no read-then-write race under concurrent views.
create or replace function public.increment_listing_views(listing_id uuid)
  returns void
  language sql
  security definer
  set search_path = public
as $$
  update public.listings set views = views + 1 where id = listing_id;
$$;

-- EXECUTE is granted to `authenticated` only: the app currently gates every
-- listing query on a signed-in user (see useListings/useListing), so anon
-- has no in-app path that would call this, and not granting it keeps the
-- RPC surface no broader than what's actually used (mirrors is_blocked()'s
-- anon exclusion in 0002).
revoke all on function public.increment_listing_views(uuid) from public;
grant execute on function public.increment_listing_views(uuid) to authenticated;
