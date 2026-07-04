-- Axis — Phase 2 Storage buckets (DRAFT — review before applying)
-- AX-401A: buckets + policies only. Upload pipeline (StorageRepository,
-- compression, avatar UI) is separate (AX-401 / AX-403).
--
-- Path convention (first folder segment is always the owning user's uid, so
-- one policy predicate covers both buckets):
--   listing-images: {seller_id}/{listing_id}/{filename}
--   avatars:        {user_id}/{filename}

insert into storage.buckets (id, name, public)
values
  ('listing-images', 'listing-images', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- listing-images: authenticated upload to own prefix, public read, owner-only
-- delete. No update policy — clients replace an image via delete + insert.
-- ---------------------------------------------------------------------------
create policy "listing_images_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'listing-images');

create policy "listing_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- avatars: same shape, keyed by user id only (no listing segment).
-- ---------------------------------------------------------------------------
create policy "avatars_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
