-- Axis — AX-704: self-service account deletion.
--
-- Deletes the auth.users row for the calling user. profiles.id references
-- auth.users(id) on delete cascade (0001), which cascades through every
-- owned row from there: listings, saved_listings (both directions),
-- messages (sender_id and receiver_id), notifications, and blocks (both
-- directions) — see 0001 for the full cascade graph. One DELETE statement
-- run inside Postgres's own transaction means either the whole graph is
-- gone or none of it is; there's no partial-delete state to recover from,
-- and there's no undo once it commits.
--
-- SECURITY DEFINER is load-bearing here, not just convention like 0006/0007:
-- `authenticated` has zero privileges on `auth.users`, so this delete fails
-- outright without it. There's no argument to the function — the target is
-- always `auth.uid()`, resolved fresh against the caller's own JWT inside
-- the SECURITY DEFINER body — so there is no parameter a caller could set to
-- reach another user's row.
create or replace function public.delete_own_account()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
