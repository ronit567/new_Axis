-- Axis — review removal tests (migration 0045).
--
-- Same harness as report_alerts_test.sql: BEGIN ... ROLLBACK, identity via
-- set local role, raises on the first failed assertion, prints
-- ALL DROP_REVIEWS TESTS PASSED on success. Run after 0045.
--
-- The schema assertions are the easy half. The one that matters is scenario
-- 4: 0045 rewrote enforce_report_rate_limit() to stop comparing a column that
-- no longer exists, and a plpgsql body is only resolved when it runs, so the
-- only proof the rewrite is sound is filing a report through it.

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

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'DROP_REVIEWS TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: the table, its content-filter function, and the report
--    column that pointed at it are all gone.
select pg_temp.assert(
  to_regclass('public.reviews') is null,
  'public.reviews should no longer exist');

select pg_temp.assert(
  to_regprocedure('public.enforce_review_content()') is null,
  'enforce_review_content() should no longer exist');

select pg_temp.assert(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports'
      and column_name = 'target_review_id'
  ),
  'reports.target_review_id should no longer exist');

-- ── Scenario 2: the queue lost its review columns and kept its access rules.
select pg_temp.assert(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports_queue'
      and column_name like 'target_review%'
  ),
  'reports_queue should have no target_review_* columns');

select pg_temp.assert(
  has_table_privilege('service_role', 'public.reports_queue', 'SELECT')
  and not has_table_privilege('anon', 'public.reports_queue', 'SELECT')
  and not has_table_privilege('authenticated', 'public.reports_queue', 'SELECT'),
  'reports_queue should stay readable by service_role only');

-- ── Scenario 3: 'review' is no longer a report target.
do $$
begin
  insert into public.reports (reporter_id, target_type, target_user_id, reason)
    values ('aaaa1111-1111-4111-8111-111111111111', 'review',
            'bbbb2222-2222-4222-8222-222222222222', 'harassment');
  raise exception 'DROP_REVIEWS TEST FAILED: a report with target_type review was accepted';
exception
  when check_violation then null; -- expected
end;
$$;

-- ── Scenario 4: a report still files through the rewritten rate-limit
--    trigger, and its duplicate guard still rejects the same report twice.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaa1111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into public.reports (reporter_id, target_type, target_user_id, reason)
  values ('aaaa1111-1111-4111-8111-111111111111', 'user',
          'bbbb2222-2222-4222-8222-222222222222', 'harassment');
reset role;

select pg_temp.assert(
  (select count(*) from public.reports
    where reporter_id = 'aaaa1111-1111-4111-8111-111111111111') = 1,
  'a user report should file through the rewritten rate-limit trigger');

do $$
begin
  insert into public.reports (reporter_id, target_type, target_user_id, reason)
    values ('aaaa1111-1111-4111-8111-111111111111', 'user',
            'bbbb2222-2222-4222-8222-222222222222', 'spam');
  raise exception 'DROP_REVIEWS TEST FAILED: the same user was reported twice while the first report was open';
exception
  when raise_exception then
    if sqlerrm like 'DROP_REVIEWS TEST FAILED%' then raise; end if;
end;
$$;

-- ── Scenario 5: a report naming nothing is still rejected.
do $$
begin
  insert into public.reports (reporter_id, target_type, reason)
    values ('aaaa1111-1111-4111-8111-111111111111', 'chat', 'other');
  raise exception 'DROP_REVIEWS TEST FAILED: a report with no target was accepted';
exception
  when check_violation then null; -- expected
end;
$$;

select 'ALL DROP_REVIEWS TESTS PASSED' as result;

rollback;
