-- Axis — read-receipt policy tests (migration 0008).
--
-- Same harness as rls_policies_test.sql: runs inside BEGIN ... ROLLBACK,
-- switches identity via set local role + request.jwt.claims, raises on the
-- first failed assertion, prints ALL READ-RECEIPT TESTS PASSED on success.
-- Kept as a separate file so it can run independently after 0008 is applied.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'sender@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
   'authenticated', 'authenticated', 'receiver@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('44444444-4444-4444-4444-444444444444', 'Sender'),
  ('55555555-5555-5555-5555-555555555555', 'Receiver');

insert into public.listings (id, seller_id, title, status) values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff',
   '44444444-4444-4444-4444-444444444444', 'Read receipt fixture', 'active');

insert into public.messages (id, listing_id, sender_id, receiver_id, body) values
  ('99999999-9999-9999-9999-999999999999',
   'ffffffff-ffff-ffff-ffff-ffffffffffff',
   '44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555',
   'unread fixture message');

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'READ-RECEIPT TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: the SENDER cannot mark the message read (not the receiver).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
update public.messages set read_at = now()
 where id = '99999999-9999-9999-9999-999999999999';
select pg_temp.assert(
  (select read_at from public.messages
    where id = '99999999-9999-9999-9999-999999999999') is null,
  'sender must not be able to set read_at on a message they sent');
reset role;

-- ── Scenario 2: the RECEIVER can mark it read, but only the read_at column —
--    the column-level grant rejects a body edit outright (42501).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

do $$
begin
  update public.messages set body = 'tampered'
   where id = '99999999-9999-9999-9999-999999999999';
  raise exception 'READ-RECEIPT TEST FAILED: receiver was able to edit body';
exception
  when insufficient_privilege then null; -- expected: UPDATE grant covers read_at only
end;
$$;

update public.messages set read_at = now()
 where id = '99999999-9999-9999-9999-999999999999';
select pg_temp.assert(
  (select read_at from public.messages
    where id = '99999999-9999-9999-9999-999999999999') is not null,
  'receiver must be able to set read_at on a message sent to them');
reset role;

select 'ALL READ-RECEIPT TESTS PASSED' as result;

rollback;
