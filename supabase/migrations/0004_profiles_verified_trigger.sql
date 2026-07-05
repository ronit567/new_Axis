-- Axis — AX-301 follow-up: `profiles.verified` must not be client-controlled.
-- RLS only checks `auth.uid() = id` on insert/update (0002), not this
-- column's value, so a modified client could otherwise upsert
-- `verified: true` regardless of its actual email domain. Recompute it
-- server-side from auth.users on every insert/update instead of trusting
-- whatever the client sends (the app no longer sends it at all — see
-- ProfileRepository.upsert).
--
-- SECURITY DEFINER (+ pinned search_path, mirroring is_blocked() in 0002) is
-- required here: auth.users is not selectable by the `authenticated` role,
-- so the trigger needs the definer's elevated privileges to read it.
create or replace function public.set_profile_verified()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  user_email text;
begin
  select email into user_email from auth.users where id = new.id;
  new.verified := coalesce(
    user_email ilike '%@uwo.ca' or user_email ilike '%@alumni.uwo.ca',
    false
  );
  return new;
end;
$$;

-- No PostgREST RPC exposure needed or wanted; only the trigger below calls it.
revoke all on function public.set_profile_verified() from public;

drop trigger if exists profiles_set_verified on public.profiles;
create trigger profiles_set_verified
  before insert or update on public.profiles
  for each row
  execute function public.set_profile_verified();
