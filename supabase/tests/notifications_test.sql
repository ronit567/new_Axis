-- Axis — notification generation + RLS tests (migration 0012).
--
-- Same harness as messages_read_receipts_test.sql: runs inside BEGIN ...
-- ROLLBACK, switches identity via set local role + request.jwt.claims, raises
-- on the first failed assertion, prints ALL NOTIFICATIONS TESTS PASSED on
-- success. Kept as a separate file so it can run independently after 0012 is
-- applied.
--
-- Two users: A (message sender / listing saver) and B (message receiver /
-- listing owner). B owns two listings — the second exists solely for the
-- block scenario, so it can carry no prior notifications to confuse the count.
-- Cross-user assertions (a row belongs to B, not A) run with the role reset
-- back to the privileged owner role, which bypasses RLS — the same pattern
-- delete_account_test.sql uses to inspect rows across identities.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'a@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'b@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B');

-- B's primary listing (scenarios 1-3, 6-7) and a second listing (scenario 5's
-- block check), both owned by B.
insert into public.listings (id, seller_id, title, status) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Notifications fixture listing', 'active'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Notifications fixture listing 2', 'active');

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'NOTIFICATIONS TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: a message from A to B generates exactly one notification for
--    B (never for A, the sender).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
insert into public.messages (listing_id, sender_id, receiver_id, body) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'hi, is this still available?');
reset role;

select pg_temp.assert(
  (select count(*) from public.notifications
    where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and type = 'message'
      and actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 1,
  'a message from A to B must generate exactly one message notification for B');
select pg_temp.assert(
  (select count(*) from public.notifications
    where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0,
  'the sender must never receive a notification for their own message');

-- ── Scenario 2: dedup — a second message on the same thread must not create
--    a second unread notification.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
insert into public.messages (listing_id, sender_id, receiver_id, body) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'following up on that');
reset role;

select pg_temp.assert(
  (select count(*) from public.notifications
    where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and type = 'message'
      and actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and read = false) = 1,
  'a second message on the same unread thread must not create a duplicate notification');

-- ── Scenario 3: A saving B's listing notifies B exactly once.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
insert into public.saved_listings (user_id, listing_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
reset role;

select pg_temp.assert(
  (select count(*) from public.notifications
    where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and type = 'listing_saved'
      and actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 1,
  'A saving B''s listing must notify B exactly once');

-- ── Scenario 4: B saving their own listing (self-save) must not notify.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
insert into public.saved_listings (user_id, listing_id) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
reset role;

select pg_temp.assert(
  (select count(*) from public.notifications where type = 'listing_saved') = 1,
  'a self-save must not generate a new listing_saved notification (still only the one from scenario 3)');

-- ── Scenario 5: B blocks A; A saving B's other listing must not notify —
--    blocked relationships suppress the saved-listing trigger just like a
--    self-save.
insert into public.blocks (blocker_id, blocked_id) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
insert into public.saved_listings (user_id, listing_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd');
reset role;

select pg_temp.assert(
  (select count(*) from public.notifications
    where listing_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') = 0,
  'a save across a block must not generate a notification for the blocked owner');

-- ── Scenario 6: RLS read isolation — A cannot read B's notifications.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from public.notifications
    where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
  'A must not be able to read B''s notifications');
reset role;

-- ── Scenario 7: RLS update isolation — A cannot mark B's notifications read.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.notifications set read = true
    where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'NOTIFICATIONS TEST FAILED: A''s update of B''s notifications affected % row(s), expected 0', n;
  end if;
end $$;
reset role;

-- ── Scenario 8: RLS insert denied — notifications are system-generated only;
--    0012 revoked the client INSERT grant entirely.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  insert into public.notifications (user_id, type) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'message');
  raise exception 'NOTIFICATIONS TEST FAILED: client insert into notifications succeeded (0012 should have revoked it)';
exception
  when insufficient_privilege then null; -- expected: 0012 revokes INSERT from authenticated
end;
$$;
reset role;

-- ── Scenario 9: create_test_notification() (0016) inserts an actorless row
--    for the caller only; anon cannot execute it.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select public.create_test_notification();
reset role;

select pg_temp.assert(
  (select count(*) from public.notifications
    where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and type = 'message'
      and actor_id is null) = 1,
  'create_test_notification must insert exactly one actorless message row for the caller');

set local role anon;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform public.create_test_notification();
  raise exception 'NOTIFICATIONS TEST FAILED: anon could execute create_test_notification';
exception
  when insufficient_privilege then null; -- expected: EXECUTE revoked from anon/public
end;
$$;
reset role;

select 'ALL NOTIFICATIONS TESTS PASSED' as result;

rollback;
