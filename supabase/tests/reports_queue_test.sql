-- Axis — reports_queue view tests (migration 0012, AX-707).
--
-- Same harness as reports_test.sql: runs inside BEGIN ... ROLLBACK, switches
-- identity via set local role + request.jwt.claims, raises on the first failed
-- assertion, prints ALL REPORTS_QUEUE TESTS PASSED on success. Run **after**
-- 0011 (reports table) and 0012 (this view) are applied.
--
-- The point of the view is triage: a reviewer sees every report with the
-- reporter/target names + emails joined in, and it must NOT be reachable from
-- the app API (anon/authenticated) — only Studio / a service_role connection.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaa1111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'reporter@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbb2222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'target@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('aaaa1111-1111-4111-8111-111111111111', 'Reporter'),
  ('bbbb2222-2222-4222-8222-222222222222', 'Target');

insert into public.listings (id, seller_id, title, status) values
  ('cccc3333-3333-4333-8333-333333333333',
   'bbbb2222-2222-4222-8222-222222222222', 'Reported listing', 'active');

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'REPORTS_QUEUE TEST FAILED: %', msg;
  end if;
end;
$$;

-- Reporter files a listing report (as the authenticated reporter, so RLS's
-- reports_insert_own is satisfied).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaa1111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into public.reports (reporter_id, target_type, target_listing_id, target_user_id, reason)
  values ('aaaa1111-1111-4111-8111-111111111111', 'listing',
          'cccc3333-3333-4333-8333-333333333333',
          'bbbb2222-2222-4222-8222-222222222222', 'prohibited_item');

-- ── Scenario 1: an authenticated user cannot read the queue at all (revoked).
do $$
begin
  perform count(*) from public.reports_queue;
  raise exception 'REPORTS_QUEUE TEST FAILED: authenticated was able to select from reports_queue';
exception
  when insufficient_privilege then
    null; -- expected: revoked from authenticated in 0012
end;
$$;
reset role;

-- ── Scenario 2: anon cannot read the queue either.
set local role anon;
do $$
begin
  perform count(*) from public.reports_queue;
  raise exception 'REPORTS_QUEUE TEST FAILED: anon was able to select from reports_queue';
exception
  when insufficient_privilege then
    null; -- expected: revoked from anon in 0012
end;
$$;
reset role;

-- ── Scenario 3: the view owner (the privileged role running this file — the
--    Studio SQL editor / service_role stand-in) sees the report with the
--    reporter/target names + emails and the listing title joined in.
select pg_temp.assert(
  (select count(*) from public.reports_queue) = 1,
  'the view owner should see the filed report');
select pg_temp.assert(
  (select reporter_name from public.reports_queue) = 'Reporter'
  and (select reporter_email from public.reports_queue) = 'reporter@test.uwo.ca',
  'the queue should join in the reporter name + email');
select pg_temp.assert(
  (select target_user_name from public.reports_queue) = 'Target'
  and (select target_user_email from public.reports_queue) = 'target@test.uwo.ca'
  and (select target_listing_title from public.reports_queue) = 'Reported listing',
  'the queue should join in the target user + listing details');
select pg_temp.assert(
  (select status from public.reports_queue) = 'open',
  'a freshly filed report should surface with status = open');

select 'ALL REPORTS_QUEUE TESTS PASSED' as result;

rollback;
