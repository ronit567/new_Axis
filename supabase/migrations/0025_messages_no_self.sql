-- Axis — 0025: forbid self-messaging (sender = receiver).
--
-- Nothing stopped a user from messaging themselves: the only guard was
-- ListingDetailScreen hiding the buyer actions on your own listing. The
-- messages table itself — unlike blocks, which has blocks_no_self — accepted
-- sender_id = receiver_id, and messages_insert_sender only pinned sender_id to
-- auth.uid(). Even notify_on_message (0013) special-cases self-sends instead
-- of rejecting them. Enforce the rule at the source so no client path (deep
-- link, stale route params, an existing self-thread in the inbox) can create
-- one again.

-- Existing self-messages are artifacts of this bug: they carry no
-- conversation with another person and would keep a self-thread alive in
-- conversation_list. Remove them so the constraint validates cleanly.
delete from public.messages where sender_id = receiver_id;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_no_self') then
    alter table public.messages
      add constraint messages_no_self check (sender_id <> receiver_id);
  end if;
end $$;

-- Same rule in the insert policy (defense in depth, mirrors the is_blocked
-- gate): a violating insert dies at RLS before ever reaching the constraint.
drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> receiver_id
    and not public.is_blocked(sender_id, receiver_id)
  );
