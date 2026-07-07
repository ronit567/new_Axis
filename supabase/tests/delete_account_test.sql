-- Axis — delete_own_account() tests (migration 0010).
--
-- Same harness as rls_policies_test.sql / messages_read_receipts_test.sql:
-- runs inside BEGIN ... ROLLBACK, switches identity via `set local role` +
-- `request.jwt.claims`, raises on the first failed assertion, prints
-- 'ALL ACCOUNT-DELETION TESTS PASSED' on success. Apply 0010 before running.
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

-- ── Scenario 3: calling it again for an id that no longer exists is a no-op,
--    not an error — the JWT claim alone doesn't require the row to exist.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select public.delete_own_account();
reset role;

select 'ALL ACCOUNT-DELETION TESTS PASSED' as result;

rollback;
