-- Axis — signup cooldown tests (migration 0031).
--
-- Same harness as the other suites: BEGIN ... ROLLBACK, pg_temp.assert raises
-- on the first failure, prints a success line at the end. Apply 0018, 0029,
-- 0030 and 0031 first.
--
-- Covers the contract of hook_restrict_signup_email() once a cooldown exists:
-- a recently-deleted address is refused, the same address is accepted again
-- once the window has passed, an untouched Western address is unaffected, and
-- the App Review whitelist outranks the cooldown.

begin;

create or replace function pg_temp.assert(ok boolean, msg text)
  returns void language plpgsql as $$
begin
  if not ok then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;

create or replace function pg_temp.hook(email text)
  returns jsonb language sql as $$
  select public.hook_restrict_signup_email(
    jsonb_build_object('user', jsonb_build_object('email', email)));
$$;

-- ── Fixtures: one address deleted just now, one deleted long ago ────────────
insert into public.deleted_account_cooldowns (email_hash, deleted_at)
values
  (public.hash_signup_email('recent@uwo.ca'), now()),
  (public.hash_signup_email('ancient@uwo.ca'),
   now() - public.signup_cooldown_window() - interval '1 day');

-- ── A Western address with no deletion history still signs up ───────────────
select pg_temp.assert(
  pg_temp.hook('fresh@uwo.ca') = '{}'::jsonb,
  'an untouched @uwo.ca address must still be allowed');

-- ── Inside the window: refused ──────────────────────────────────────────────
select pg_temp.assert(
  pg_temp.hook('recent@uwo.ca') ? 'error',
  'an address deleted just now must be refused');
select pg_temp.assert(
  (pg_temp.hook('recent@uwo.ca') -> 'error' ->> 'http_code') = '403',
  'the cooldown rejection must carry http_code 403');
select pg_temp.assert(
  (pg_temp.hook('recent@uwo.ca') -> 'error' ->> 'message') like '%deleted%',
  'the cooldown message must explain why, not reuse the domain message');

-- ── Case-insensitivity: the hash is over the lowercased address ─────────────
select pg_temp.assert(
  pg_temp.hook('RECENT@UWO.CA') ? 'error',
  'the cooldown must not be evadable by changing capitalisation');

-- ── Past the window: allowed again, without needing the row removed ─────────
select pg_temp.assert(
  pg_temp.hook('ancient@uwo.ca') = '{}'::jsonb,
  'an address whose cooldown has expired must be allowed again');

-- ── Whitelist outranks the cooldown (App Review re-creates its account) ─────
insert into public.signup_email_exceptions (email, note)
values ('reviewer@uwo.ca', 'test fixture');
insert into public.deleted_account_cooldowns (email_hash, deleted_at)
values (public.hash_signup_email('reviewer@uwo.ca'), now());
select pg_temp.assert(
  pg_temp.hook('reviewer@uwo.ca') = '{}'::jsonb,
  'a whitelisted address must bypass the cooldown');

-- ── The domain rule still applies to everyone else ──────────────────────────
select pg_temp.assert(
  pg_temp.hook('someone@gmail.com') ? 'error',
  'a non-Western address must still be refused');

-- ── Only a hash is stored — never the address ───────────────────────────────
select pg_temp.assert(
  not exists (
    select 1 from public.deleted_account_cooldowns
     where email_hash like '%@%'),
  'the cooldown table must never contain a readable email address');

select 'ALL SIGNUP-COOLDOWN TESTS PASSED' as result;

rollback;
