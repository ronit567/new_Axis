-- Axis — 0030: delete a listing's images when the listing row goes away.
--
-- 0029 covered account deletion. This covers the other path into the same
-- orphan: deleting a single listing. ListingRepository.deleteListing() removes
-- the row and leaves every uploaded photo in the bucket, and because
-- listing-images is `public = true` (0014) those photos stay fetchable at
-- their original URLs indefinitely — someone who deletes a listing because
-- they no longer want it public has not actually made it private.
--
-- Implemented as a trigger rather than client-side cleanup so it also fires on
-- the paths the client never sees: the profiles -> listings cascade during
-- account deletion, and any admin/SQL deletion.
--
-- STATEMENT-level with a transition table, not FOR EACH ROW. Deleting an
-- account with N listings would otherwise run N separate deletes against
-- storage.objects; this handles the whole statement in one.
--
-- Path convention (0014, and StorageRepository.uploadListingPhotoSet):
--   listing-images/{seller_id}/{listing_id}/{index}[_thumb].jpg
-- so path_tokens[1] and [2] identify a listing's folder exactly. path_tokens
-- is storage.objects' own generated column — cheaper than re-deriving the
-- segments with storage.foldername() per row.
create or replace function public.cleanup_deleted_listing_images()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- SECURITY DEFINER because this must work for both callers: `authenticated`
  -- deleting their own listing (whose 0014 policy would allow it anyway) and
  -- the cascade inside delete_own_account(). It cannot be used to reach
  -- another user's files: the rows it matches come from `deleted`, and RLS on
  -- public.listings only ever lets a seller delete their own.
  delete from storage.objects o
  using deleted d
  where o.bucket_id = 'listing-images'
    and o.path_tokens[1] = d.seller_id::text
    and o.path_tokens[2] = d.id::text;
  return null;
end;
$$;

revoke all on function public.cleanup_deleted_listing_images() from public, anon, authenticated;

drop trigger if exists listings_cleanup_images on public.listings;

create trigger listings_cleanup_images
  after delete on public.listings
  referencing old table as deleted
  for each statement
  execute function public.cleanup_deleted_listing_images();

-- 0029 keeps its own listing-images delete. It is now largely redundant (this
-- trigger fires during that cascade) but is retained deliberately as a
-- backstop: it is keyed only on seller_id, so it also sweeps up stray objects
-- under a user's prefix that no listing row points at — a partially-failed
-- upload, for instance, where the objects landed but the listing insert did
-- not. Avatars remain 0029's alone; no listing row is involved in those.
