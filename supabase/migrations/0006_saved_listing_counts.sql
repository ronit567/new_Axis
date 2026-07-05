-- Axis — 0006: per-listing saved-by-others counts for ManageListingsScreen (AX-401)
--
-- ListingRepository.getBySeller needs, for each of the seller's own listings,
-- how many *different users* have saved it. saved_select_own (0002) scopes
-- select on saved_listings to `auth.uid() = user_id`, so a direct query from
-- the app only ever sees the caller's own save rows — for a seller looking at
-- their own listings that's effectively always 0 (a seller saving their own
-- listing is the rare exception, not the norm), never the real count.
--
-- Same shape as is_blocked() (0002): a SECURITY DEFINER function bypasses the
-- per-row RLS restriction just enough to aggregate across users, but stays
-- scoped to `seller_id = auth.uid()` so it can only ever return counts for
-- the *caller's own* listings — it can't be used to probe how popular
-- someone else's listing is. STABLE + a pinned search_path per Supabase's
-- SECURITY DEFINER guidance.
create or replace function public.my_listing_save_counts()
  returns table (listing_id uuid, saves bigint)
  language sql
  security definer
  set search_path = public
  stable
as $$
  select sl.listing_id, count(*)::bigint as saves
  from public.saved_listings sl
  join public.listings l on l.id = sl.listing_id
  where l.seller_id = auth.uid()
  group by sl.listing_id;
$$;

-- EXECUTE granted to authenticated only — anon can't own listings, so this
-- would only ever return an empty set for them, but there's no reason to
-- expose the RPC to signed-out callers at all.
grant execute on function public.my_listing_save_counts() to authenticated;
