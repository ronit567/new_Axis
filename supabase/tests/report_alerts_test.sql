-- Axis — report alerting tests (migration 0043).
--
-- Same harness as reports_queue_test.sql: BEGIN ... ROLLBACK, identity via
-- set local role, raises on the first failed assertion, prints
-- ALL REPORT_ALERTS TESTS PASSED on success. Run after 0011, 0012 and 0043
-- (and 0046, for scenario 7).
--
-- The property that matters most here is the negative one: filing a report
-- must succeed even when alerting cannot run. The vault secrets are absent in
-- a test transaction, which is exactly the misconfigured case, so scenario 1
-- exercises the fallback path for free.

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
    raise exception 'REPORT_ALERTS TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: a report files successfully with the trigger attached and the
--    vault secrets missing. The alert is skipped with a warning; the row lands.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaa1111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into public.reports (reporter_id, target_type, target_listing_id, target_user_id, reason)
  values ('aaaa1111-1111-4111-8111-111111111111', 'listing',
          'cccc3333-3333-4333-8333-333333333333',
          'bbbb2222-2222-4222-8222-222222222222', 'prohibited_item');
reset role;

select pg_temp.assert(
  (select count(*) from public.reports) = 1,
  'a report must still be filed when alerting is unconfigured');

-- ── Scenario 2: the trigger is actually attached to reports, AFTER INSERT,
--    per row. A silently detached trigger is the failure mode that would put
--    us back where the audit found us.
select pg_temp.assert(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'reports'
      and t.tgname = 'reports_notify_new'
      and not t.tgisinternal
      -- pg_trigger.tgtype bits: 1 = FOR EACH ROW, 2 = BEFORE, 4 = INSERT,
      -- 64 = INSTEAD OF. AFTER is the absence of BEFORE and INSTEAD, not a
      -- bit of its own.
      and t.tgtype & 1 = 1     -- FOR EACH ROW
      and t.tgtype & 4 = 4     -- ON INSERT
      and t.tgtype & 2 = 0     -- not BEFORE
      and t.tgtype & 64 = 0    -- not INSTEAD OF
  ),
  'reports_notify_new should be an AFTER INSERT ... FOR EACH ROW trigger on reports');

-- ── Scenario 3: the alerter can read the joined view, because the edge
--    function calls it as service_role. 0012 left service_role without SELECT,
--    which is why this grant exists at all.
select pg_temp.assert(
  has_table_privilege('service_role', 'public.reports_queue', 'SELECT'),
  'service_role should be able to read reports_queue');

-- ── Scenario 4: the grant 0043 adds is on the VIEW, not on a table.
--
--    Deliberately not asserted here: that service_role cannot read `reports`
--    itself. On the hosted project it cannot (it holds only Dxtm — see the
--    closing note in 0040), but that is a property of how that project was
--    provisioned, not something any migration in this repo establishes: a
--    stack built from these files alone gives service_role the Supabase
--    default of full table privileges. Asserting it would test the
--    environment and fail locally while passing in production, which is worth
--    less than nothing in a migration suite.
select pg_temp.assert(
  exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'service_role'
      and table_schema = 'public'
      and table_name = 'reports_queue'
      and privilege_type = 'SELECT'
  ),
  'the SELECT 0043 grants service_role should be recorded against the view');

-- ── Scenario 5: the app roles are unchanged by 0043 — still no queue access.
select pg_temp.assert(
  not has_table_privilege('anon', 'public.reports_queue', 'SELECT')
  and not has_table_privilege('authenticated', 'public.reports_queue', 'SELECT'),
  'anon and authenticated must still be unable to read reports_queue');

-- ── Scenario 6: the trigger function is not callable by the app roles (0038).
select pg_temp.assert(
  not has_function_privilege('anon', 'public.notify_new_report()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.notify_new_report()', 'EXECUTE'),
  'notify_new_report must not be executable by anon or authenticated');

-- ── Scenario 7 (0046): the same report filed twice is still rejected, and the
--    message — which the app shows verbatim — no longer promises a response
--    time. Scenario 1's report is still open, so this collides with it.
do $$
begin
  insert into public.reports (reporter_id, target_type, target_listing_id, target_user_id, reason)
    values ('aaaa1111-1111-4111-8111-111111111111', 'listing',
            'cccc3333-3333-4333-8333-333333333333',
            'bbbb2222-2222-4222-8222-222222222222', 'spam');
  raise exception 'REPORT_ALERTS TEST FAILED: a duplicate report was accepted';
exception
  when raise_exception then
    if sqlerrm like 'REPORT_ALERTS TEST FAILED%' then raise; end if;
    if sqlerrm ~* '24|hour' then
      raise exception 'REPORT_ALERTS TEST FAILED: the duplicate-report message still promises a response time: %', sqlerrm;
    end if;
end;
$$;

select 'ALL REPORT_ALERTS TESTS PASSED' as result;

rollback;
