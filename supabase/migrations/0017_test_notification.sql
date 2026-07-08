-- Axis — 0017: dev/test helper to generate a notification on demand (AX-601).
--
-- 0013 revoked client INSERT on public.notifications (rows are trigger-only),
-- which also makes the feature hard to exercise by hand. This RPC is the
-- sanctioned back door: SECURITY DEFINER, inserts a canned actorless 'message'
-- notification for the CALLER ONLY, so the worst an abuser can do is spam
-- themselves. Drives the __DEV__ test panel on NotificationsScreen and
-- exercises the full pipeline (insert → realtime event → bell/list update).
create or replace function public.create_test_notification()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'create_test_notification: not signed in';
  end if;
  insert into public.notifications (user_id, type)
  values (auth.uid(), 'message');
end;
$$;

-- Functions grant EXECUTE to PUBLIC by default; restrict to signed-in users.
revoke execute on function public.create_test_notification() from public, anon;
grant execute on function public.create_test_notification() to authenticated;
