-- Axis — Phase 2 Storage buckets (DRAFT — review before applying)
-- AX-401A: buckets + policies only. Upload pipeline (StorageRepository,
-- compression, avatar UI) is separate (AX-401 / AX-403).
--
-- Path convention (first folder segment is always the owning user's uid, so
-- one predicate covers both buckets):
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
-- Upsert (not `do nothing`): if a bucket was created manually (e.g. via the
-- dashboard) without limits, `do nothing` would silently leave those weaker
-- settings in place and the guardrails below would never take effect. Force
-- the intended public flag, size cap, and mime allowlist on every apply.
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Idempotency. Drop our own policies first so re-applying this migration
-- converges to exactly the set below. This does NOT remove *other* permissive
-- policies (e.g. a Supabase dashboard "allow all authenticated" default) —
-- those are neutralised by the RESTRICTIVE policy at the end of this file.
-- ---------------------------------------------------------------------------
drop policy if exists "listing_images_select_own" on storage.objects;
drop policy if exists "listing_images_insert_own" on storage.objects;
drop policy if exists "listing_images_delete_own" on storage.objects;
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
drop policy if exists "storage_owner_prefix_restrict" on storage.objects;

-- ---------------------------------------------------------------------------
-- listing-images: authenticated upload/delete/list scoped to the owner's own
-- prefix. No update policy — clients replace an image via delete + insert.
--
-- Read model: "public read" is served by the bucket's `public = true` flag,
-- not by an RLS policy. `getPublicUrl()` hits the /object/public/ route, which
-- bypasses RLS entirely, so anyone with a stored image URL can render it while
-- signed out. The SELECT policy below therefore only governs the RLS-gated
-- paths (`list()` and authenticated `download()`), and is scoped owner-only
-- (same predicate as insert/delete) so an authenticated user cannot enumerate
-- other users' object paths — which would otherwise leak every seller_id /
-- listing_id present in the bucket. Owners can still `list()` their own files.
-- ---------------------------------------------------------------------------
create policy "listing_images_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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
create policy "avatars_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

-- ---------------------------------------------------------------------------
-- Defense-in-depth: RESTRICTIVE owner-scoping for these two buckets.
--
-- PostgreSQL OR's all PERMISSIVE policies for the same (command, role), so a
-- pre-existing broad policy — e.g. a Supabase "allow authenticated access"
-- default — would OR with the owner-scoped policies above and let any
-- authenticated user read/modify the whole bucket, defeating the intent. A
-- RESTRICTIVE policy is AND'ed instead: it can only narrow access, so it caps
-- every command on listing-images/avatars to the caller's own prefix no matter
-- what other permissive policies exist. Scoped `to authenticated` to mirror the
-- policies above; other buckets are untouched (the bucket_id guard is true for
-- them), and the public-read route (getPublicUrl) bypasses RLS entirely so it
-- is unaffected.
-- ---------------------------------------------------------------------------
create policy "storage_owner_prefix_restrict"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id not in ('listing-images', 'avatars')
    or (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id not in ('listing-images', 'avatars')
    or (storage.foldername(name))[1] = auth.uid()::text
  );
