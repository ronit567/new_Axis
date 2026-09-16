-- Axis — 0047: let our own storage cleanup past Supabase's delete guard.
--
-- Supabase Storage now installs storage.protect_delete() as a BEFORE DELETE
-- ... FOR EACH STATEMENT trigger on storage.objects (supabase/storage#817,
-- January 2026). Unless the session sets storage.allow_delete_query = 'true',
-- any DELETE on that table raises:
--
--   42501  Direct deletion from storage tables is not allowed. Use the Storage API instead.
--
-- Two of our functions delete from storage.objects in SQL, so on any project
-- with that trigger both of them now abort the whole transaction:
--
--   * delete_own_account() (0029, redefined in 0031): Settings -> Delete
--     account fails with "Delete account failed", and nothing is deleted.
--     App Review exercises this on every submission (Guideline 5.1.1(v)).
--   * cleanup_deleted_listing_images() (0030): the AFTER DELETE trigger on
--     listings. Deleting a listing fails, and because it also runs inside the
--     account-deletion cascade, so does deleting an account a second time
--     over. It also blocks the moderation runbook's `delete from listings`
--     and `delete from auth.users`.
--
-- Being a statement-level trigger, it fires even when the DELETE would match
-- no rows, so users with no uploads are affected too. 42501 is
-- insufficient_privilege, which is why a local run of delete_account_test
-- looked like a grant difference rather than this.
--
-- The fix is the setting the Storage API itself uses, scoped as tightly as
-- possible: set to 'true' immediately before our one storage DELETE, restored
-- to whatever it was immediately after, and transaction-local either way, so
-- it cannot outlive the statement that needed it.
--
-- WHAT THIS DOES NOT FIX: deleting the storage.objects row makes the file
-- unreachable (its URL 404s), but Supabase does not remove the underlying
-- blob when the row is deleted in SQL. That was already true of 0029/0030 and
-- is unchanged here. Removing the blobs themselves means deleting through the
-- Storage API, which is a separate change.
-- ---------------------------------------------------------------------------

-- Full redefinition of 0031's body; only the storage delete is wrapped.
create or replace function public.delete_own_account()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  prev_allow_delete text;
begin
  if uid is null then
    raise exception 'delete_own_account: not signed in';
  end if;

  -- Read the address before the delete removes it. Hashed immediately; the
  -- plaintext never leaves this function.
  select email into user_email from auth.users where id = uid;

  -- Storage is outside the FK graph — see 0029. storage.protect_delete() — see
  -- the header — rejects this unless the flag is set.
  prev_allow_delete := current_setting('storage.allow_delete_query', true);
  perform set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects
  where bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = uid::text;

  perform set_config('storage.allow_delete_query', coalesce(prev_allow_delete, 'false'), true);

  if user_email is not null then
    -- Opportunistic purge: expired rows are dead weight, and doing this on
    -- write avoids needing pg_cron for a table that only grows on deletion.
    delete from public.deleted_account_cooldowns
    where deleted_at < now() - public.signup_cooldown_window();

    -- Re-deleting a re-created account restarts the window, hence the upsert.
    insert into public.deleted_account_cooldowns (email_hash, deleted_at)
    values (public.hash_signup_email(user_email), now())
    on conflict (email_hash) do update set deleted_at = excluded.deleted_at;
  end if;

  -- Cascades to listings, whose cleanup_deleted_listing_images() trigger
  -- deletes from storage.objects again. It sets and restores the flag itself.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- Full redefinition of 0030's body; only the storage delete is wrapped. The
-- trigger itself (listings_cleanup_images) is unchanged and still points here.
create or replace function public.cleanup_deleted_listing_images()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  prev_allow_delete text;
begin
  -- SECURITY DEFINER because this must work for both callers: `authenticated`
  -- deleting their own listing (whose 0014 policy would allow it anyway) and
  -- the cascade inside delete_own_account(). It cannot be used to reach
  -- another user's files: the rows it matches come from `deleted`, and RLS on
  -- public.listings only ever lets a seller delete their own.
  prev_allow_delete := pg_catalog.current_setting('storage.allow_delete_query', true);
  perform pg_catalog.set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects o
  using deleted d
  where o.bucket_id = 'listing-images'
    and o.path_tokens[1] = d.seller_id::text
    and o.path_tokens[2] = d.id::text;

  perform pg_catalog.set_config(
    'storage.allow_delete_query', coalesce(prev_allow_delete, 'false'), true
  );
  return null;
end;
$$;

revoke all on function public.cleanup_deleted_listing_images() from public, anon, authenticated;
