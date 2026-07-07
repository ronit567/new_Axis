-- Axis — reports policy tests (migration 0011).
--
-- Same harness as rls_policies_test.sql / messages_read_receipts_test.sql:
-- runs inside BEGIN ... ROLLBACK, switches identity via set local role +
-- request.jwt.claims, raises on the first failed assertion, prints ALL
-- REPORTS TESTS PASSED on success. Kept as a separate file so it can run
-- independently after 0011 is applied.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666',
   'authenticated', 'authenticated', 'reporter@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777',
   'authenticated', 'authenticated', 'other@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('66666666-6666-6666-6666-666666666666', 'Reporter'),
  ('77777777-7777-7777-7777-777777777777', 'Other');

insert into public.listings (id, seller_id, title, status) values
  ('88888888-8888-8888-8888-888888888888',
   '77777777-7777-7777-7777-777777777777', 'Reported listing fixture', 'active');

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'REPORTS TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: REPORTER can file a report and read it back.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);

insert into public.reports (reporter_id, target_type, target_user_id, reason)
  values ('66666666-6666-6666-6666-666666666666', 'user',
          '77777777-7777-7777-7777-777777777777', 'harassment');

insert into public.reports (reporter_id, target_type, target_listing_id, target_user_id, reason)
  values ('66666666-6666-6666-6666-666666666666', 'listing',
          '88888888-8888-8888-8888-888888888888',
          '77777777-7777-7777-7777-777777777777', 'prohibited_item');

select pg_temp.assert(
  (select count(*) from public.reports) = 2,
  'reporter should see both of their own filed reports');

-- A report needs at least one target — neither a user nor a listing set must
-- be rejected by reports_target_present.
do $$
begin
  insert into public.reports (reporter_id, target_type, reason)
    values ('66666666-6666-6666-6666-666666666666', 'user', 'spam');
  raise exception 'REPORTS TEST FAILED: insert with no target succeeded (reports_target_present not enforced)';
exception
  when check_violation then null; -- expected
end;
$$;

-- Can't file a report on someone else's behalf.
do $$
begin
  insert into public.reports (reporter_id, target_type, target_user_id, reason)
    values ('77777777-7777-7777-7777-777777777777', 'user',
            '66666666-6666-6666-6666-666666666666', 'other');
  raise exception 'REPORTS TEST FAILED: reporter was able to insert a report as a different reporter_id';
exception
  when insufficient_privilege then null; -- expected: reports_insert_own requires auth.uid() = reporter_id
end;
$$;
reset role;

-- ── Scenario 2: OTHER cannot see REPORTER's reports, and cannot insert one
--    claiming to be REPORTER (mirrors scenario 1's second check, from the
--    other side — belt and suspenders since RLS with check and select are
--    separate policies).
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);

select pg_temp.assert(
  (select count(*) from public.reports) = 0,
  'non-reporter must not see another user''s filed reports — would leak who reported them');

do $$
begin
  insert into public.reports (reporter_id, target_type, target_user_id, reason)
    values ('66666666-6666-6666-6666-666666666666', 'user',
            '77777777-7777-7777-7777-777777777777', 'spam');
  raise exception 'REPORTS TEST FAILED: a user was able to insert a report impersonating another reporter_id';
exception
  when insufficient_privilege then null; -- expected
end;
$$;
reset role;

-- ── Scenario 3: anon can neither read nor file reports.
set local role anon;
select set_config('request.jwt.claims', '', true);

select pg_temp.assert(
  (select count(*) from public.reports) = 0,
  'anon must not see any reports');

do $$
begin
  insert into public.reports (reporter_id, target_type, target_user_id, reason)
    values ('66666666-6666-6666-6666-666666666666', 'user',
            '77777777-7777-7777-7777-777777777777', 'spam');
  raise exception 'REPORTS TEST FAILED: anon was able to insert a report';
exception
  when insufficient_privilege then null; -- expected: no policy grants anon insert
end;
$$;
reset role;

select 'ALL REPORTS TESTS PASSED' as result;

rollback;
