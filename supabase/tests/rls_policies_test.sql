-- Axis — RLS policy tests (owner vs non-owner vs anon vs blocked).
--
-- Runs 0001 + 0002 must already be applied. Execute this whole file in the
-- Supabase SQL editor or via psql against the project DB. It:
--   * runs inside BEGIN ... ROLLBACK, so it leaves NO data behind;
--   * seeds 3 users + fixtures;
--   * switches identity with `set local role` + a fake JWT claim (so auth.uid()
--     resolves to each user) and asserts what each identity can see/do;
--   * raises an exception on the first failed assertion (the whole run aborts),
--     and prints 'ALL RLS TESTS PASSED' on success.
--
-- Identity switching uses set_config('request.jwt.claims', ...) which is how
-- Supabase's auth.uid() reads the current user. RESET ROLE returns to the
-- privileged login role between scenarios.
--
-- NOTE: seeding auth.users requires a privileged role (the SQL editor / postgres
-- run as that). If your project restricts direct auth.users inserts, swap the
-- three inserts for your project's user-creation helper.

begin;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Three users: OWNER, OTHER (unrelated), BLOCKED (OWNER has blocked them).
-- Beyond (id, aud, role, email), several GoTrue versions added NOT NULL
-- columns with no default (instance_id, encrypted_password, the
-- confirmation/recovery/email-change tokens). These users never actually log
-- in — identity is forced below via request.jwt.claims — so the values are
-- inert placeholders, just present so the insert satisfies NOT NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'owner@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'other@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'blocked@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'Other'),
  ('33333333-3333-3333-3333-333333333333', 'Blocked');

-- OWNER: one active + one sold listing. BLOCKED: one active listing.
insert into public.listings (id, seller_id, title, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Owner active', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Owner sold',   'sold'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Blocked user active', 'active');

-- OWNER's private rows.
insert into public.saved_listings (user_id, listing_id)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.messages (id, listing_id, sender_id, receiver_id, body) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'hi from owner to other');

-- A conversation between OWNER and BLOCKED that predates the block below —
-- used to assert the block does not retroactively erase message history.
insert into public.messages (id, listing_id, sender_id, receiver_id, body) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'hi before the block, e.g. a pickup arrangement');

-- OWNER blocks BLOCKED.
insert into public.blocks (blocker_id, blocked_id)
  values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

-- Assertion helper: raises on false. Lives in pg_temp (dropped at rollback).
create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'RLS TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: OWNER sees own active + own sold, but NOT the blocked user's
--    active listing (block hides it). Expected visible = {aaaa, bbbb} = 2.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from public.listings) = 2,
  'owner should see own active + own sold, and NOT the blocked user''s listing');
select pg_temp.assert(
  (select count(*) from public.listings
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 0,
  'owner must not see a blocked user''s listing');
-- Blocking hides new contact, not history: the owner can still read the
-- pre-block conversation with the now-blocked user.
select pg_temp.assert(
  (select count(*) from public.messages
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') = 1,
  'owner must still see pre-block message history with a now-blocked user');
reset role;

-- ── Scenario 2: OTHER (unrelated) sees all active, non-blocked listings:
--    owner-active + blocked-user-active = {aaaa, cccc} = 2. Not owner's sold.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from public.listings) = 2,
  'unrelated user should see both active listings');
select pg_temp.assert(
  (select count(*) from public.listings
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
  'unrelated user must not see someone else''s SOLD listing');
-- non-owner cannot mutate the owner's listing (RLS makes it match 0 rows).
do $$
declare n int;
begin
  update public.listings set title = 'hijacked'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'RLS TEST FAILED: non-owner UPDATE affected % row(s), expected 0', n;
  end if;
end $$;
-- non-owner cannot see the owner's private saved rows or messages.
select pg_temp.assert(
  (select count(*) from public.saved_listings) = 0,
  'non-owner must not see another user''s saved_listings');
reset role;

-- ── Scenario 3: BLOCKED user. Mutual block hides the OWNER's active listing
--    from them; they still see their own active. Expected visible = {cccc} = 1.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from public.listings) = 1,
  'blocked user should see only their own active listing (owner hidden by block)');
select pg_temp.assert(
  (select count(*) from public.listings
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0,
  'blocked user must not see the blocker''s listing (mutual)');
-- Same history preserved from the blocked side.
select pg_temp.assert(
  (select count(*) from public.messages
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') = 1,
  'blocked user must still see pre-block message history with the blocker');
reset role;

-- ── Scenario 4: message across a block is rejected at INSERT (WITH CHECK).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  insert into public.messages (listing_id, sender_id, receiver_id, body)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
          '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111',
          'trying to reach the blocker');
  raise exception 'RLS TEST FAILED: blocked user was able to message the blocker';
exception
  when insufficient_privilege then
    null; -- expected: RLS WITH CHECK rejected the insert
end;
$$;
reset role;

-- ── Scenario 5: anonymous visitor sees active listings only, no block filter,
--    no sold. Expected visible = {aaaa, cccc} = 2; private tables = 0.
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.assert(
  (select count(*) from public.listings) = 2,
  'anon should see both active listings');
select pg_temp.assert(
  (select count(*) from public.listings where status = 'sold') = 0,
  'anon must not see sold listings');
select pg_temp.assert(
  (select count(*) from public.messages) = 0,
  'anon must not see any messages');
select pg_temp.assert(
  (select count(*) from public.saved_listings) = 0,
  'anon must not see any saved_listings');
-- anon has no EXECUTE grant on is_blocked(): it's SECURITY DEFINER and
-- PostgREST exposes any EXECUTE-granted function as an RPC, so granting it
-- to anon would let an unauthenticated caller probe block relationships
-- directly, bypassing RLS on the blocks table.
do $$
begin
  perform public.is_blocked(
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333');
  raise exception 'RLS TEST FAILED: anon was able to execute is_blocked() directly';
exception
  when insufficient_privilege then
    null; -- expected: no EXECUTE grant for anon
end;
$$;
reset role;

-- If we got here, every assertion passed.
do $$ begin raise notice 'ALL RLS TESTS PASSED'; end $$;

rollback;
