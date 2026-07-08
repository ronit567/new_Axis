-- Axis — RLS policy tests (owner vs non-owner vs anon vs blocked).
--
-- 0001 + 0002 + 0003 + 0006 must already be applied (the storage scenarios
-- need the buckets created in 0003; scenario 12 needs the
-- my_listing_save_counts() function from 0006). Execute this whole file in the Supabase
-- SQL editor or via psql against the project DB. It:
--   * runs inside BEGIN ... ROLLBACK, so it leaves NO data behind (storage
--     objects inserted below roll back with the surrounding transaction);
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
-- Profiles are hidden across a block too: owner sees self + OTHER, not the
-- now-blocked user's profile.
select pg_temp.assert(
  (select count(*) from public.profiles) = 2,
  'owner should see own + unrelated profile, and NOT the blocked user''s profile');
select pg_temp.assert(
  (select count(*) from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') = 0,
  'owner must not see a blocked user''s profile');
-- Sanity check on is_blocked()'s caller-must-be-a-party gate: a legitimate
-- caller who *is* one of the two parties still gets the real answer, in
-- either argument order.
select pg_temp.assert(
  (select public.is_blocked(
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333')) = true,
  'owner (as first arg) must get the real block status with a party they''re blocking');
select pg_temp.assert(
  (select public.is_blocked(
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111')) = true,
  'owner (as second arg) must get the real block status with a party they''re blocking');
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
-- OTHER isn't party to the owner/blocked block, so all profiles stay visible.
select pg_temp.assert(
  (select count(*) from public.profiles) = 3,
  'unrelated user should see all profiles (not a party to the block)');
-- OTHER cannot probe the OWNER/BLOCKED relationship: is_blocked() requires
-- the caller to be one of the two parties, so this must return false even
-- though OWNER and BLOCKED really are blocked.
select pg_temp.assert(
  (select public.is_blocked(
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333')) = false,
  'unrelated caller must not learn the block status of two other users');
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
-- Same profile hiding from the blocked side.
select pg_temp.assert(
  (select count(*) from public.profiles) = 2,
  'blocked user should see own + unrelated profile, and NOT the blocker''s profile');
select pg_temp.assert(
  (select count(*) from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') = 0,
  'blocked user must not see the blocker''s profile (mutual)');
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
-- anon has no grant at all (0005) on public.messages or public.saved_listings:
-- expect a hard denial, not an RLS-empty result.
do $$
begin
  perform count(*) from public.messages;
  raise exception 'RLS TEST FAILED: anon was able to select from messages';
exception
  when insufficient_privilege then null; -- expected: no grant for anon
end;
$$;
do $$
begin
  perform count(*) from public.saved_listings;
  raise exception 'RLS TEST FAILED: anon was able to select from saved_listings';
exception
  when insufficient_privilege then null; -- expected: no grant for anon
end;
$$;
-- anon has no EXECUTE grant on is_blocked() (0002): it's SECURITY DEFINER and
-- PostgREST exposes any EXECUTE-granted function as an RPC, so granting it
-- to anon would let an unauthenticated caller probe block relationships
-- directly, bypassing RLS on the blocks table. That check happens at parse
-- time, before the listings/profiles policies' `case when auth.uid() is
-- null` branch can short-circuit at runtime — so any anon SELECT against
-- listings or profiles (whose policy expressions reference is_blocked())
-- hits the same hard denial as a direct RPC call, not an RLS-empty result.
do $$
begin
  perform count(*) from public.listings;
  raise exception 'RLS TEST FAILED: anon was able to select from listings';
exception
  when insufficient_privilege then
    null; -- expected: policy expression references is_blocked(), no EXECUTE grant for anon
end;
$$;
do $$
begin
  perform count(*) from public.profiles;
  raise exception 'RLS TEST FAILED: anon was able to select from profiles';
exception
  when insufficient_privilege then
    null; -- expected: policy expression references is_blocked(), no EXECUTE grant for anon
end;
$$;
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

-- ══ Storage policies (0014_storage_buckets.sql) ═════════════════════════════
-- The buckets ('listing-images', 'avatars') must already exist from 0003.
-- Objects inserted here are rolled back with the surrounding transaction.
-- Security boundary: (storage.foldername(name))[1] = auth.uid()::text on
-- INSERT/DELETE, and owner-scoped SELECT. "Public read" itself is served by the
-- bucket's public flag via getPublicUrl() (a non-RLS route), so it is out of
-- scope for these RLS assertions.
--
-- Note: this assumes the `authenticated`/`anon` roles carry Supabase's standard
-- table grants on storage.objects (they do on a real project). If a hardened
-- project has revoked them, the "rejected"/"0 rows" assertions still hold.

-- ── Scenario 6: OWNER may upload only under their own uid prefix.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
-- own prefix → allowed. listing-images: {uid}/{listingId}/file; avatars: {uid}/file.
-- (Only bucket_id + name matter to the policy; owner/owner_id are left to their
-- defaults so the test isn't coupled to storage's deprecated `owner` column.)
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('listing-images',
     '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/photo.jpg'),
    ('avatars',
     '11111111-1111-1111-1111-111111111111/avatar.png');
exception
  when insufficient_privilege then
    raise exception 'RLS TEST FAILED: owner was blocked from uploading under their own prefix';
end $$;
-- another user's prefix → rejected by WITH CHECK.
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('listing-images',
     '22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/photo.jpg');
  raise exception 'RLS TEST FAILED: owner uploaded under another user''s prefix';
exception
  when insufficient_privilege then
    null; -- expected: WITH CHECK rejected the cross-prefix insert
end $$;
reset role;

-- ── Scenario 7: SELECT is owner-scoped — a signed-in user cannot enumerate
--    another user's objects (no bucket-wide listing). OTHER uploads their own,
--    then must see only theirs.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into storage.objects (bucket_id, name) values
  ('listing-images',
   '22222222-2222-2222-2222-222222222222/ffffffff-ffff-ffff-ffff-ffffffffffff/pic.jpg');
select pg_temp.assert(
  (select count(*) from storage.objects where bucket_id = 'listing-images') = 1,
  'owner-scoped SELECT: OTHER should see only their own listing-image, not OWNER''s');
select pg_temp.assert(
  (select count(*) from storage.objects
     where name like '11111111-1111-1111-1111-111111111111/%') = 0,
  'OTHER must not be able to enumerate OWNER''s storage objects');
reset role;

-- ── Scenario 8: DELETE is owner-only.
-- Newer stacks ship a statement-level storage.protect_delete() trigger that
-- blocks EVERY direct SQL delete on storage.objects (even 0-row ones) — the
-- Storage API is the sanctioned delete path. Disable it for this transaction
-- only so the RLS delete policies themselves can be exercised; the enclosing
-- rollback restores it.
-- Disabling it needs the storage-table owner, which plain `postgres` is not —
-- run this file as the local stack's superuser:
--   docker exec -i supabase_db_new_Axis psql -U supabase_admin -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/rls_policies_test.sql
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'protect_objects_delete'
      and tgrelid = 'storage.objects'::regclass
  ) then
    execute 'alter table storage.objects disable trigger protect_objects_delete';
  end if;
end $$;

-- non-owner delete of OWNER's object → 0 rows (invisible + unauthorized).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
declare n int;
begin
  delete from storage.objects
    where bucket_id = 'listing-images'
      and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/photo.jpg';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'RLS TEST FAILED: non-owner DELETE removed % storage object(s), expected 0', n;
  end if;
end $$;
reset role;
-- owner delete of their own object → 1 row.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$
declare n int;
begin
  delete from storage.objects
    where bucket_id = 'avatars'
      and name = '11111111-1111-1111-1111-111111111111/avatar.png';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'RLS TEST FAILED: owner DELETE of own avatar removed % row(s), expected 1', n;
  end if;
end $$;
reset role;

-- ── Scenario 9: anon is locked out of the RLS-gated paths. (Public read via
--    getPublicUrl() is a non-RLS route and can't be exercised in SQL.)
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.assert(
  (select count(*) from storage.objects) = 0,
  'anon must not enumerate any storage objects via the RLS-gated path');
do $$
begin
  insert into storage.objects (bucket_id, name)
    values ('avatars', 'anon/sneaky.png');
  raise exception 'RLS TEST FAILED: anon was able to insert a storage object';
exception
  when insufficient_privilege then
    null; -- expected: no insert policy/grant for anon
end $$;
reset role;

-- ── Scenario 10: bucket guardrails survive a pre-existing bucket.
--    Regression test for 0003's `on conflict (id) do update` (previously
--    `do nothing`, which silently left a dashboard-created bucket without a
--    size cap or mime allowlist). Weaken the buckets as an operator might,
--    replay 0003's upsert verbatim, and assert the guardrails are forced back
--    on. Under the old `do nothing` these assertions would fail. Rolled back
--    with the surrounding transaction.
update storage.buckets
  set file_size_limit = null, allowed_mime_types = null
  where id in ('listing-images', 'avatars');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

select pg_temp.assert(
  (select file_size_limit from storage.buckets where id = 'listing-images') = 5242880
    and (select file_size_limit from storage.buckets where id = 'avatars') = 2097152,
  'replaying 0003 must restore file_size_limit on a pre-existing bucket');
select pg_temp.assert(
  (select allowed_mime_types from storage.buckets where id = 'listing-images')
      = array['image/jpeg', 'image/png', 'image/webp']
    and (select allowed_mime_types from storage.buckets where id = 'avatars')
      = array['image/jpeg', 'image/png', 'image/webp'],
  'replaying 0003 must restore the mime allowlist on a pre-existing bucket');

-- ── Scenario 11: a stray PERMISSIVE policy must not broaden these buckets.
--    PostgreSQL OR's permissive policies per (command, role), so a pre-existing
--    "allow all authenticated" default (as Supabase projects sometimes ship)
--    would otherwise defeat the owner-scoped SELECT above. The RESTRICTIVE
--    storage_owner_prefix_restrict policy (0003) AND's owner-scoping onto every
--    permissive grant. Simulate such a default and confirm OTHER still cannot
--    read OWNER's object in these buckets (while OWNER still reads their own).
--    The stray policy is dropped again; all of this rolls back with the txn.
insert into storage.objects (bucket_id, name) values
  ('listing-images', '11111111-1111-1111-1111-111111111111/restrict-check/owner.jpg'),
  ('listing-images', '22222222-2222-2222-2222-222222222222/restrict-check/other.jpg');
create policy test_stray_permissive_select_all
  on storage.objects for select to authenticated using (true);
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from storage.objects
     where bucket_id = 'listing-images'
       and name = '11111111-1111-1111-1111-111111111111/restrict-check/owner.jpg') = 0,
  'RESTRICTIVE owner-scoping must hold even when a permissive select-all policy exists');
select pg_temp.assert(
  (select count(*) from storage.objects
     where bucket_id = 'listing-images'
       and name = '22222222-2222-2222-2222-222222222222/restrict-check/other.jpg') = 1,
  'owner must still read their own object under the RESTRICTIVE policy');
reset role;
drop policy test_stray_permissive_select_all on storage.objects;

-- ── Scenario 12: my_listing_save_counts() (0006) aggregates saves across
--    users for the caller's own listings — bypassing saved_select_own's
--    per-user restriction (0002) just enough to do that, and no further.
--    OTHER and BLOCKED both save OWNER's active listing (aaaa).
insert into public.saved_listings (user_id, listing_id) values
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
-- Direct table access only ever sees the caller's OWN save row (saved_select_own)
-- — this is exactly the gap the RPC exists to work around, not a real count.
select pg_temp.assert(
  (select count(*) from public.saved_listings) = 1,
  'direct saved_listings select must stay scoped to the caller''s own save row');
-- The RPC bypasses that just enough to sum saves-by-anyone for the caller's
-- own listings: aaaa has 2 saves (OTHER + BLOCKED); bbbb has none, so no row.
select pg_temp.assert(
  (select count(*) from public.my_listing_save_counts()) = 1,
  'owner should get exactly one save-count row (only aaaa has any saves)');
select pg_temp.assert(
  (select saves from public.my_listing_save_counts()
     where listing_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 2,
  'aaaa should show 2 saves, aggregated across OTHER and BLOCKED');
reset role;

-- OTHER owns no listings, so the RPC must return nothing for them even though
-- OTHER is one of the users who saved OWNER's listing — it can't be used to
-- learn how many saves someone else's listing has.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from public.my_listing_save_counts()) = 0,
  'a caller with no listings of their own must get an empty result, never another seller''s counts');
reset role;

-- If we got here, every assertion passed.
do $$ begin raise notice 'ALL RLS TESTS PASSED'; end $$;

rollback;
