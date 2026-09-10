-- Axis — 0039: avatars become a private bucket, served through signed URLs.
--
-- 0014 created both buckets with `public = true`. For listing photos that is
-- the right call — item photos are the public half of a marketplace. For
-- avatars it is not: they are usually photographs of a student, and a public
-- bucket serves its objects over an unauthenticated URL that bypasses RLS
-- entirely (the /object/public/ route). 0034 deliberately closed anonymous
-- access to `profiles` so the student directory could not be enumerated with
-- the bundled anon key — but the photo attached to each of those profiles
-- stayed world-readable to anyone holding its URL, which is not what the
-- privacy policy tells students ("visible to other verified students").
--
-- Paths are UUID-keyed so they cannot be guessed, but they are not secret:
-- every authenticated client receives them in the profile JSON.
--
-- ---------------------------------------------------------------------------
-- THE TRADE-OFF THIS MAKES, STATED PLAINLY
-- ---------------------------------------------------------------------------
-- A signed URL is minted through the RLS-gated path: createSignedUrl() requires
-- SELECT on the object. 0014 scoped `avatars_select_own` to the caller's own
-- prefix, which is correct for a public bucket (where SELECT only governs
-- list()/download(), and reads happen over the public route). Once the bucket
-- is private, that same policy means a user can only ever sign *their own*
-- avatar — every other user's photo in the app would fail to load.
--
-- So SELECT on avatars is widened here to any authenticated user. The net
-- change in exposure is still a clear improvement:
--
--   before — anyone on the internet holding the URL, forever, no account
--   after  — a signed-in Axis user, via a URL that expires in an hour
--
-- but it is NOT "only the owner can see it", and one consequence is worth
-- naming: a user who has been blocked can still mint a signed URL for the
-- blocking user's avatar object if they kept the path, even though
-- profiles_select_public (0034) hides that profile from them. Closing that
-- would mean minting signed URLs from an Edge Function that consults
-- is_blocked() rather than from the client. That is the right eventual shape;
-- it is deliberately out of scope here.
--
-- INSERT / UPDATE / DELETE stay owner-scoped in both buckets, unchanged.

-- ---------------------------------------------------------------------------
-- 1. The bucket flag. listing-images is left public on purpose — see above.
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id = 'avatars';

-- ---------------------------------------------------------------------------
-- 2. Permissive SELECT: any signed-in user may read an avatar object, which is
--    what lets them sign one. Replaces 0014's owner-only version.
--
--    listing_images_select_own is untouched: that bucket is still public, so
--    its SELECT policy still only governs list()/download(), and keeping it
--    owner-scoped continues to stop an authenticated user from enumerating
--    every seller_id / listing_id in the bucket (0014's reasoning).
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_select_authenticated" on storage.objects;

create policy "avatars_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- 3. The RESTRICTIVE backstop, split by command.
--
--    0014's `storage_owner_prefix_restrict` was `for all`, so it AND-ed the
--    owner check onto every command including SELECT — which would silently
--    defeat step 2 no matter what the permissive policy above says (RESTRICTIVE
--    policies can only narrow). It has to be split so SELECT can be widened for
--    avatars while writes stay capped.
--
--    The SELECT predicate reads: everything is allowed except listing-images,
--    which stays owner-only. That is equivalent to 0014's
--    `bucket_id not in (...) or owner` for every bucket — third-party buckets
--    and avatars both evaluate true — just written without naming avatars.
--
--    The write predicates are 0014's, verbatim, one per command.
-- ---------------------------------------------------------------------------
drop policy if exists "storage_owner_prefix_restrict" on storage.objects;
drop policy if exists "storage_owner_prefix_restrict_select" on storage.objects;
drop policy if exists "storage_owner_prefix_restrict_insert" on storage.objects;
drop policy if exists "storage_owner_prefix_restrict_update" on storage.objects;
drop policy if exists "storage_owner_prefix_restrict_delete" on storage.objects;

create policy "storage_owner_prefix_restrict_select"
  on storage.objects as restrictive for select
  to authenticated
  using (
    bucket_id <> 'listing-images'
    or (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_owner_prefix_restrict_insert"
  on storage.objects as restrictive for insert
  to authenticated
  with check (
    bucket_id not in ('listing-images', 'avatars')
    or (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_owner_prefix_restrict_update"
  on storage.objects as restrictive for update
  to authenticated
  using (
    bucket_id not in ('listing-images', 'avatars')
    or (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id not in ('listing-images', 'avatars')
    or (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_owner_prefix_restrict_delete"
  on storage.objects as restrictive for delete
  to authenticated
  using (
    bucket_id not in ('listing-images', 'avatars')
    or (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 4. Backfill: profiles.avatar_url stops holding a URL and starts holding an
--    object path.
--
--    A signed URL expires, so it cannot be persisted — the column has to store
--    the durable thing (the path) and the client signs it at render time.
--    Existing rows hold the full public URL, which stops resolving the moment
--    step 1 runs, so this conversion is part of the same transaction.
--
--    Anchored on the fixed public-route prefix rather than a loose split, so a
--    value that is already a bare path (or null) is left alone and re-applying
--    this migration is a no-op. The trailing split_part drops a query string if
--    one was ever appended.
-- ---------------------------------------------------------------------------
update public.profiles
   set avatar_url = split_part(
         regexp_replace(avatar_url, '^.*/storage/v1/object/public/avatars/', ''),
         '?', 1)
 where avatar_url like '%/storage/v1/object/public/avatars/%';

comment on column public.profiles.avatar_url is
  'Object path inside the private `avatars` bucket ({user_id}/{timestamp}.{ext}), NOT a URL. Clients mint a short-lived signed URL from it (see src/lib/avatarUrls.ts). Was a public URL before 0039.';
