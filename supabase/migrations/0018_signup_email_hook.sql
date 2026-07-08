-- Axis — AX-601-adjacent: server-side signup email enforcement.
--
-- The @uwo.ca gate (`isWesternEmail`, src/lib/email.ts) only runs in the app's
-- CreateAccountScreen. Anyone calling supabase.auth.signUp directly with the
-- anon key (curl, a modified client, etc.) bypasses it entirely and creates a
-- non-Western account. This migration adds a Postgres function meant for
-- Supabase Auth's **before-user-created hook**, which rejects the signup
-- server-side before the auth.users row is even created, plus a
-- Studio-editable exceptions table so the Apple App Review demo account (and
-- any future reviewer address) can be whitelisted without a code change.
--
-- IMPORTANT: the hook itself must be enabled by hand — Dashboard →
-- Authentication → Hooks → "Before User Created" → Postgres function →
-- public.hook_restrict_signup_email. There is no migration-level way to wire
-- an Auth hook up, so until that toggle is flipped this function exists but
-- is never called and signup is unaffected.

create table public.signup_email_exceptions (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

insert into public.signup_email_exceptions (email, note) values (
  'applereview@axis.app',
  'Apple App Review demo account — replace with the real reviewer email before submission'
);

-- RLS binds supabase_auth_admin too — it is NOT the table owner, so without a
-- policy the hook would see an empty table and the whitelist would silently
-- stop working. anon/authenticated get no policies at all, so they see
-- nothing (and have no grant to query it regardless — see below).
alter table public.signup_email_exceptions enable row level security;

create policy signup_email_exceptions_select_auth_admin
  on public.signup_email_exceptions
  for select
  to supabase_auth_admin
  using (true);

-- Keeps PostgREST from exposing this table at all; mirrors the
-- reports_queue revoke pattern in 0012. No sequence to revoke usage on —
-- email is the primary key, not a serial column.
grant select on public.signup_email_exceptions to supabase_auth_admin;
revoke all on public.signup_email_exceptions from anon, authenticated, public;

-- Plain plpgsql, NOT security definer: the auth server calls this as
-- supabase_auth_admin, which already has the select grant above, so a
-- definer escalation isn't needed (and would just be extra surface).
create or replace function public.hook_restrict_signup_email(event jsonb)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  -- lower() case-normalizes; the table's CHECK keeps stored exceptions
  -- lowercase too, so this is an exact match against lowered values.
  -- Missing/empty email coalesces to '' and falls through to rejection
  -- (fail closed — this app is email-signup only, there's no legitimate
  -- case where the incoming event has no email).
  user_email text := lower(coalesce(event->'user'->>'email', ''));
begin
  -- `like '%@uwo.ca'` is a true suffix match including the leading '@', so
  -- `x@uwo.ca.evil.com` does NOT match (the '@' would have to appear right
  -- before "uwo.ca" at the end of the string, which it doesn't there).
  if user_email like '%@uwo.ca'
     or user_email like '%@alumni.uwo.ca'
     or exists (select 1 from public.signup_email_exceptions e
                where e.email = user_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'message', 'Only @uwo.ca email addresses can join Axis.',
    'http_code', 403));
end;
$$;

-- No PostgREST exposure wanted; only the auth server (as supabase_auth_admin)
-- calls this, same reasoning as the table grants above.
grant execute on function public.hook_restrict_signup_email(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_email(jsonb) from authenticated, anon, public;
