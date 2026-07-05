-- Axis — Phase 2 Storage buckets (DRAFT — review before applying)
-- AX-401A: buckets + policies only. Upload pipeline (StorageRepository,
-- compression, avatar UI) is separate (AX-401 / AX-403).
--
-- Path convention (first folder segment is always the owning user's uid, so
-- one policy predicate covers both buckets):
--   listing-images: {seller_id}/{listing_id}/{filename}
--   avatars:        {user_id}/{filename}
--
-- Bucket-level guardrails: image-only mime allowlist + a per-file size cap,
-- so an authenticated user can't stash arbitrary large/non-image files under
-- their own prefix while the real upload pipeline (compression, resizing) is
-- still pending in AX-401.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- listing-images: authenticated upload to own prefix, public read, owner-only
-- delete. No update policy — clients replace an image via delete + insert.
--
-- Read note: the bucket's `public = true` flag (not this policy) is what lets
-- `getPublicUrl()` serve a file to a signed-out request — that route bypasses
-- RLS entirely. The `select` policy below only gates `list()`/authenticated
-- `download()`, so it's scoped `to authenticated` (matching every other
-- policy in this project) rather than `to public`, to stop an anonymous
-- caller from enumerating bucket contents.
-- ---------------------------------------------------------------------------
create policy "listing_images_select_authenticated"
  on storage.objects for select
  to authenticated
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
create policy "avatars_select_authenticated"
  on storage.objects for select
  to authenticated
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
