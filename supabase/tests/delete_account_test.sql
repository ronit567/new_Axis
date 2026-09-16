-- Axis — delete_own_account() tests (migration 0010).
--
-- Same harness as rls_policies_test.sql / messages_read_receipts_test.sql:
-- runs inside BEGIN ... ROLLBACK, switches identity via `set local role` +
-- `request.jwt.claims`, raises on the first failed assertion, prints
-- 'ALL ACCOUNT-DELETION TESTS PASSED' on success. Apply 0010, 0014, 0029,
-- 0030 and 0047 before running (0014 creates the buckets the storage fixtures
-- below need).
--
-- The suite installs Supabase Storage's delete guard if the local stack lacks
-- it (see "Storage delete guard" below), so it tests against the same storage
-- behaviour as the hosted project whatever storage image is running locally.
--
-- Two users: DYING (calls delete_own_account() on themself) and SURVIVOR
-- (an unrelated party who also shares a message thread with DYING). The
-- assertions check both halves of the contract: everything DYING owned —
-- and everything the cascade graph reaches through them, including the
-- shared message thread — is gone, while SURVIVOR's own independent rows
-- are completely untouched.

begin;

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666',
   'authenticated', 'authenticated', 'dying@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777',
   'authenticated', 'authenticated', 'survivor@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('66666666-6666-6666-6666-666666666666', 'Dying'),
  ('77777777-7777-7777-7777-777777777777', 'Survivor');

insert into public.listings (id, seller_id, title, status) values
  ('66666666-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'Dying''s listing', 'active'),
  ('77777777-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'Survivor''s listing', 'active');

-- DYING saved their own listing (just a row to prove it's gone); SURVIVOR
-- saved their own listing too (proves SURVIVOR's row is untouched).
insert into public.saved_listings (user_id, listing_id) values
  ('66666666-6666-6666-6666-666666666666', '66666666-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777777777', '77777777-1111-1111-1111-111111111111');

-- A message thread that spans both users, about SURVIVOR's listing — this is
-- the row that documents the real tradeoff: deleting DYING's account takes
-- the whole thread with it (sender_id cascades), even though SURVIVOR is a
-- party to it too. See 0010 / supabase/README.md for why this is accepted
-- rather than anonymized.
insert into public.messages (id, listing_id, sender_id, receiver_id, body) values
  ('66666666-2222-2222-2222-222222222222',
   '77777777-1111-1111-1111-111111111111',
   '66666666-6666-6666-6666-666666666666',
   '77777777-7777-7777-7777-777777777777',
   'hey is this still available?');

insert into public.notifications (id, user_id, type) values
  ('66666666-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', 'message'),
  ('77777777-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'message');

insert into public.blocks (blocker_id, blocked_id) values
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777');

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'ACCOUNT-DELETION TEST FAILED: %', msg;
  end if;
end;
$$;

-- Storage objects. These are NOT reachable by any FK from profiles/auth.users,
-- which is exactly why 0029 has to delete them explicitly — the cascade that
-- covers every table above stops dead at the bucket. Names follow 0014's
-- convention, first path segment = owning user id.
insert into storage.objects (id, bucket_id, name)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'listing-images',
   '66666666-6666-6666-6666-666666666666/66666666-1111-1111-1111-111111111111/photo.jpg'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'avatars',
   '66666666-6666-6666-6666-666666666666/avatar.png'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'listing-images',
   '77777777-7777-7777-7777-777777777777/77777777-1111-1111-1111-111111111111/photo.jpg');

-- ── Storage delete guard ────────────────────────────────────────────────────
-- storage.protect_delete() (supabase/storage#817) rejects any DELETE on
-- storage.objects unless storage.allow_delete_query = 'true'. It is what made
-- 0029/0030 fail on the hosted project, and 0047 is the fix. A local stack
-- only has it if its storage image is new enough, and without it this suite
-- passes against exactly the bug it should catch — so install the same guard
-- when it is missing. The stand-in function lives in public, not storage,
-- because the test role may not be allowed to create objects in the storage
-- schema. Rolled back with everything else.
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and t.tgname = 'protect_objects_delete'
  ) then
    create function public.test_storage_protect_delete()
      returns trigger
      language plpgsql
    as $guard$
    begin
      if coalesce(current_setting('storage.allow_delete_query', true), 'false') != 'true' then
        raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
          using errcode = '42501';
      end if;
      return null;
    end;
    $guard$;

    create trigger protect_objects_delete
      before delete on storage.objects
      for each statement
      execute function public.test_storage_protect_delete();
  end if;
end;
$$;

-- ── Scenario 0: the guard is active. If a plain DELETE gets through, nothing
--    below proves 0047 works.
do $$
begin
  delete from storage.objects where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  raise exception 'ACCOUNT-DELETION TEST FAILED: the storage delete guard is not active';
exception
  when insufficient_privilege then
    null; -- expected: 42501 from the storage delete guard
end;
$$;

-- ── Scenario 1: anon has no EXECUTE grant — mirrors is_blocked()'s exclusion
--    in rls_policies_test.sql. Only `authenticated` should ever reach this.
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform public.delete_own_account();
  raise exception 'ACCOUNT-DELETION TEST FAILED: anon was able to execute delete_own_account()';
exception
  when insufficient_privilege then
    null; -- expected: no EXECUTE grant for anon
end;
$$;
reset role;

-- ── Scenario 2: DYING deletes their own account.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select public.delete_own_account();
reset role;

-- Back to the privileged role to inspect everything, including auth.users
-- (authenticated has no direct select on it either way).

-- 0047 sets storage.allow_delete_query only around its own deletes. If it
-- leaked, every later statement in the transaction could bypass the guard.
select pg_temp.assert(
  coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true',
  'delete_own_account() must restore storage.allow_delete_query when it is done');

select pg_temp.assert(
  not exists (select 1 from auth.users where id = '66666666-6666-6666-6666-666666666666'),
  'the auth.users row for the deleted account must be gone');
select pg_temp.assert(
  not exists (select 1 from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  'profiles cascades from auth.users and must be gone');
select pg_temp.assert(
  not exists (select 1 from public.listings where seller_id = '66666666-6666-6666-6666-666666666666'),
  'listings owned by the deleted account must be gone');
select pg_temp.assert(
  not exists (select 1 from public.saved_listings where user_id = '66666666-6666-6666-6666-666666666666'),
  'saved_listings rows owned by the deleted account must be gone');
select pg_temp.assert(
  not exists (
    select 1 from public.messages
     where sender_id = '66666666-6666-6666-6666-666666666666'
        or receiver_id = '66666666-6666-6666-6666-666666666666'),
  'every message the deleted account sent or received must be gone, including shared threads');
select pg_temp.assert(
  not exists (select 1 from public.notifications where user_id = '66666666-6666-6666-6666-666666666666'),
  'notifications for the deleted account must be gone');
select pg_temp.assert(
  not exists (
    select 1 from public.blocks
     where blocker_id = '66666666-6666-6666-6666-666666666666'
        or blocked_id = '66666666-6666-6666-6666-666666666666'),
  'blocks involving the deleted account (either direction) must be gone');

select pg_temp.assert(
  not exists (
    select 1 from storage.objects
     where bucket_id = 'listing-images'
       and (storage.foldername(name))[1] = '66666666-6666-6666-6666-666666666666'),
  'listing images uploaded by the deleted account must be gone (no FK reaches storage)');
select pg_temp.assert(
  not exists (
    select 1 from storage.objects
     where bucket_id = 'avatars'
       and (storage.foldername(name))[1] = '66666666-6666-6666-6666-666666666666'),
  'the deleted account''s avatar must be gone — it stayed publicly fetchable before 0029');

-- ── SURVIVOR's own, unrelated rows must be completely untouched.
select pg_temp.assert(
  exists (select 1 from auth.users where id = '77777777-7777-7777-7777-777777777777'),
  'an unrelated user''s auth.users row must survive');
select pg_temp.assert(
  exists (select 1 from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  'an unrelated user''s profile must survive');
select pg_temp.assert(
  exists (select 1 from public.listings where id = '77777777-1111-1111-1111-111111111111'),
  'an unrelated user''s listing must survive');
select pg_temp.assert(
  exists (
    select 1 from public.saved_listings
     where user_id = '77777777-7777-7777-7777-777777777777'
       and listing_id = '77777777-1111-1111-1111-111111111111'),
  'an unrelated user''s own saved_listings row must survive');
select pg_temp.assert(
  exists (select 1 from public.notifications where user_id = '77777777-7777-7777-7777-777777777777'),
  'an unrelated user''s notifications must survive');

select pg_temp.assert(
  exists (
    select 1 from storage.objects
     where bucket_id = 'listing-images'
       and (storage.foldername(name))[1] = '77777777-7777-7777-7777-777777777777'),
  'an unrelated user''s listing images must survive');

-- ── Scenario 3: calling it again for an id that no longer exists is a no-op,
--    not an error — the JWT claim alone doesn't require the row to exist.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select public.delete_own_account();
reset role;

-- ── Scenario 4: deleting a single listing (0030's trigger, fixed in 0047)
--    removes that listing's images and leaves the guard armed afterwards.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
delete from public.listings where id = '77777777-1111-1111-1111-111111111111';
reset role;

select pg_temp.assert(
  not exists (select 1 from public.listings where id = '77777777-1111-1111-1111-111111111111'),
  'a seller must be able to delete their own listing');
select pg_temp.assert(
  not exists (select 1 from storage.objects where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'deleting a listing must remove its images');
select pg_temp.assert(
  coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true',
  'cleanup_deleted_listing_images() must restore storage.allow_delete_query when it is done');

select 'ALL ACCOUNT-DELETION TESTS PASSED' as result;

rollback;
