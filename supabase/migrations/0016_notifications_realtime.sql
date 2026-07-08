-- Notifications: Realtime change events for the live bell (AX-601).
-- postgres_changes respects RLS, so a subscriber only ever receives their own
-- notification rows. Guarded so a re-run (or a project where the table was
-- already added by hand) doesn't error — same shape as 0008 for messages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
