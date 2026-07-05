-- Messages: read receipts + Realtime (AX-113; groundwork for AX-501/AX-503).
--
-- Numbered 0005 on purpose: the open PRs for storage buckets and profile
-- onboarding both stake out 0003/0004. Do not renumber below them.

-- read_at: null = unread. Set by the receiver when they open the thread.
alter table public.messages
  add column if not exists read_at timestamptz;

-- The receiver may update a message row, but column-level grants restrict the
-- writable surface to read_at alone — body/sender/receiver/listing stay
-- immutable even though the RLS policy row-qualifies the whole row.
revoke update on table public.messages from anon, authenticated;
grant update (read_at) on table public.messages to authenticated;

create policy "messages_update_receiver_read"
  on public.messages for update
  to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- "My unread messages" is the hot path: conversation-list unread counts and
-- the future tab badge (AX-503). Partial index keeps it cheap.
create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id)
  where read_at is null;

-- Enable Realtime change events on messages (AX-501). postgres_changes
-- respects RLS, so a subscriber only ever receives rows they could select —
-- i.e. conversations they participate in. Guarded so a re-run (or a project
-- where the table was already added by hand) doesn't error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
