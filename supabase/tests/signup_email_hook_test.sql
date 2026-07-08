-- Axis — signup email hook tests (migration 0018).
--
-- Same harness as reports_queue_test.sql: runs inside BEGIN ... ROLLBACK,
-- switches identity via set local role, raises on the first failed
-- assertion, prints ALL SIGNUP EMAIL HOOK TESTS PASSED on success. Run
-- **after** 0018.
--
-- public.hook_restrict_signup_email() is called directly here with
-- fabricated event payloads — there's no way to trigger the real
-- before-user-created Auth hook from SQL, since it isn't wired up by
-- migration (see 0018's header). This exercises the function's logic and its
-- grants exactly as the hook would use them.

begin;

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'SIGNUP EMAIL HOOK TEST FAILED: %', msg;
  end if;
end;
$$;

-- ── Scenario 1: a plain @uwo.ca address is allowed.
select pg_temp.assert(
  public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', 'student@uwo.ca'))
  ) = '{}'::jsonb,
  'student@uwo.ca should be allowed');

-- ── Scenario 2: @alumni.uwo.ca is allowed.
select pg_temp.assert(
  public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', 'grad@alumni.uwo.ca'))
  ) = '{}'::jsonb,
  'grad@alumni.uwo.ca should be allowed');

-- ── Scenario 3: case is normalized before the domain check.
select pg_temp.assert(
  public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', 'STUDENT@UWO.CA'))
  ) = '{}'::jsonb,
  'STUDENT@UWO.CA should be allowed (case-normalized)');

-- ── Scenario 4: a non-Western address is rejected with a 403.
select pg_temp.assert(
  (public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', 'someone@gmail.com'))
  )->'error'->>'http_code') = '403',
  'someone@gmail.com should be rejected with http_code 403');

-- ── Scenario 5: a suffix-spoofed domain does not slip through the LIKE match.
select pg_temp.assert(
  (public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', 'x@uwo.ca.evil.com'))
  )->'error'->>'http_code') = '403',
  'x@uwo.ca.evil.com should be rejected (suffix spoof)');

-- ── Scenario 6: the whitelisted Apple review account is allowed, case-insensitively.
select pg_temp.assert(
  public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', 'APPLEREVIEW@axis.app'))
  ) = '{}'::jsonb,
  'APPLEREVIEW@axis.app should be allowed via the exceptions table');

-- ── Scenario 7: a missing/empty email fails closed.
select pg_temp.assert(
  (public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object())
  )->'error'->>'http_code') = '403',
  'a missing email key should be rejected (fail closed)');
select pg_temp.assert(
  (public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', ''))
  )->'error'->>'http_code') = '403',
  'an empty email should be rejected (fail closed)');

-- ── Scenario 8: grants — only supabase_auth_admin can reach the function or
--    the exceptions table; anon/authenticated get neither (revoked in 0018).
select pg_temp.assert(
  has_function_privilege('supabase_auth_admin',
    'public.hook_restrict_signup_email(jsonb)', 'execute'),
  'supabase_auth_admin should have execute on hook_restrict_signup_email');
select pg_temp.assert(
  has_table_privilege('supabase_auth_admin',
    'public.signup_email_exceptions', 'select'),
  'supabase_auth_admin should have select on signup_email_exceptions');

set local role anon;
select pg_temp.assert(
  has_function_privilege('anon',
    'public.hook_restrict_signup_email(jsonb)', 'execute') = false,
  'anon should not have execute on hook_restrict_signup_email');
select pg_temp.assert(
  has_table_privilege('anon',
    'public.signup_email_exceptions', 'select') = false,
  'anon should not have select on signup_email_exceptions');
reset role;

set local role authenticated;
select pg_temp.assert(
  has_function_privilege('authenticated',
    'public.hook_restrict_signup_email(jsonb)', 'execute') = false,
  'authenticated should not have execute on hook_restrict_signup_email');
select pg_temp.assert(
  has_table_privilege('authenticated',
    'public.signup_email_exceptions', 'select') = false,
  'authenticated should not have select on signup_email_exceptions');
reset role;

select 'ALL SIGNUP EMAIL HOOK TESTS PASSED' as result;

rollback;
