-- Axis — 0029: delete a user's uploaded images along with their account.
--
-- 0010 deletes the auth.users row and lets the public-schema FK graph cascade
-- through profiles/listings/messages/etc. That graph is complete — every FK
-- added since (reports 0011, follows 0019, reviews 0020, edit requests 0021)
-- is `on delete cascade`.
--
-- Storage is NOT in that graph. storage.objects has no FK to profiles or
-- auth.users, so nothing cascaded to it: a deleted user's avatar and every
-- listing photo they ever uploaded stayed in the bucket permanently. Both
-- buckets are `public = true` (0014), so those files also stayed publicly
-- fetchable at their original URLs after the account was gone — an erasure
-- problem for avatars in particular, which are usually photos of a person.
--
-- The delete is keyed on the first path segment, the same predicate 0014's
-- own owner-scoped policies use:
--   listing-images: {seller_id}/{listing_id}/{filename}
--   avatars:        {user_id}/{filename}
--
-- Both statements run in the function's single transaction, so the account and
-- its images go together or neither does.
--
-- NOTE ON THE UNDERLYING FILES: removing the storage.objects row is what makes
-- an object unreachable — the public URL 404s immediately, which is the
-- property that matters for erasure. The backing S3 blob is reclaimed by
-- Supabase's own storage housekeeping rather than by this statement.
create or replace function public.delete_own_account()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  -- Resolve the caller once and fail closed. 0010 inlined auth.uid() into the
  -- delete, where a null uid simply matched nothing; now that a second
  -- statement keys off the same value, an explicit guard is clearer than
  -- relying on two separate no-ops.
  if uid is null then
    raise exception 'delete_own_account: not signed in';
  end if;

  delete from storage.objects
  where bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = uid::text;

  delete from auth.users where id = uid;
end;
$$;

-- Unchanged from 0010, restated because `create or replace` does not alter
-- existing grants and this file should be self-contained if replayed.
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
