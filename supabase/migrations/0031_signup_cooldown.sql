-- Axis — 0031: a 14-day cooldown before a deleted account's email can sign up
-- again.
--
-- Deleting an account removes the auth.users row outright (0010/0029), so
-- nothing records that the address ever existed and a user could delete and
-- immediately re-register. That makes deletion a cheap way to shed a bad
-- review history, escape a block, or churn through reports — on a campus
-- marketplace where reputation is most of the trust signal, that matters.
--
-- Enforced in hook_restrict_signup_email() (0018), which is already wired to
-- Auth's before-user-created hook, so the rejection happens server-side before
-- an auth.users row exists. There is nothing to enforce client-side.
--
-- PRIVACY: only a SHA-256 of the lowercased email is stored, never the address.
-- Equality is all the check needs, and having just fixed erasure gaps (0029)
-- it would be incoherent to retain readable addresses of deleted accounts.
-- Rows are also purged once expired, so the table holds at most 14 days of
-- hashes rather than growing forever.
create table if not exists public.deleted_account_cooldowns (
  email_hash  text primary key,
  deleted_at  timestamptz not null default now()
);

comment on table public.deleted_account_cooldowns is
  'SHA-256 hashes of emails whose Axis account was deleted, gating re-signup for 14 days. Never stores the address itself.';

-- Same lockdown as signup_email_exceptions (0018): RLS on, no policies for
-- anon/authenticated, and PostgREST kept away entirely. Only the auth server
-- (as supabase_auth_admin, via the hook) and SECURITY DEFINER functions read it.
alter table public.deleted_account_cooldowns enable row level security;

drop policy if exists deleted_account_cooldowns_select_auth_admin
  on public.deleted_account_cooldowns;
create policy deleted_account_cooldowns_select_auth_admin
  on public.deleted_account_cooldowns
  for select
  to supabase_auth_admin
  using (true);

grant select on public.deleted_account_cooldowns to supabase_auth_admin;
revoke all on public.deleted_account_cooldowns from anon, authenticated, public;

-- One definition of the window, so the function and the user-facing message
-- can never disagree about how long the cooldown is.
create or replace function public.signup_cooldown_window()
  returns interval
  language sql
  immutable
as $$ select interval '14 days' $$;

create or replace function public.hash_signup_email(email text)
  returns text
  language sql
  immutable
as $$ select encode(sha256(lower(coalesce(email, ''))::bytea), 'hex') $$;

-- Neither helper needs a PostgREST surface. hash_signup_email in particular
-- would otherwise be a callable RPC that confirms hashes for arbitrary input.
revoke execute on function public.signup_cooldown_window() from public, anon, authenticated;
revoke execute on function public.hash_signup_email(text) from public, anon, authenticated;
grant execute on function public.signup_cooldown_window() to supabase_auth_admin;
grant execute on function public.hash_signup_email(text) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- delete_own_account: record the hash before the row disappears.
-- Full redefinition (0010 -> 0029 -> here), since `create or replace` replaces
-- the whole body and this file must be correct on its own.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
begin
  if uid is null then
    raise exception 'delete_own_account: not signed in';
  end if;

  -- Read the address before the delete removes it. Hashed immediately; the
  -- plaintext never leaves this function.
  select email into user_email from auth.users where id = uid;

  -- Storage is outside the FK graph — see 0029.
  delete from storage.objects
  where bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = uid::text;

  if user_email is not null then
    -- Opportunistic purge: expired rows are dead weight, and doing this on
    -- write avoids needing pg_cron for a table that only grows on deletion.
    delete from public.deleted_account_cooldowns
    where deleted_at < now() - public.signup_cooldown_window();

    -- Re-deleting a re-created account restarts the window, hence the upsert.
    insert into public.deleted_account_cooldowns (email_hash, deleted_at)
    values (public.hash_signup_email(user_email), now())
    on conflict (email_hash) do update set deleted_at = excluded.deleted_at;
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- hook_restrict_signup_email: cooldown check added ahead of the domain check.
-- Full redefinition for the same reason as above.
-- ---------------------------------------------------------------------------
create or replace function public.hook_restrict_signup_email(event jsonb)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  user_email text := lower(coalesce(event->'user'->>'email', ''));
  cooldown_until timestamptz;
begin
  -- Whitelist wins over every rule, cooldown included: the App Review demo
  -- account gets deleted and re-created between review cycles and must not be
  -- locked out for two weeks.
  if exists (select 1 from public.signup_email_exceptions e
             where e.email = user_email) then
    return '{}'::jsonb;
  end if;

  select c.deleted_at + public.signup_cooldown_window()
    into cooldown_until
    from public.deleted_account_cooldowns c
   where c.email_hash = public.hash_signup_email(user_email);

  if cooldown_until is not null and cooldown_until > now() then
    return jsonb_build_object('error', jsonb_build_object(
      'message', 'This email had an Axis account that was deleted. You can sign up again after '
                 || to_char(cooldown_until, 'FMMon FMDD, YYYY') || '.',
      'http_code', 403));
  end if;

  -- Suffix match includes the leading '@', so x@uwo.ca.evil.com does not pass.
  if user_email like '%@uwo.ca' or user_email like '%@alumni.uwo.ca' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'message', 'Only @uwo.ca email addresses can join Axis.',
    'http_code', 403));
end;
$$;

grant execute on function public.hook_restrict_signup_email(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_email(jsonb) from authenticated, anon, public;
