-- Axis — 0012: notification generation + wiring (AX-601/602).
--
-- Builds on the notifications table drafted in 0001 (id, user_id, type,
-- listing_id, read, created_at). Adds the columns the feature needs, two
-- SECURITY DEFINER triggers that write rows on new message / listing save, and
-- locks down the placeholder client INSERT policy from 0002 (notifications are
-- system-generated, never client-inserted).
--
-- Additive only: 0002 is already applied, so its notifications_insert_own
-- policy is dropped here rather than edited in place.

-- ── Schema: columns for generation, deep-link, and read-state ───────────────
alter table public.notifications
  add column if not exists actor_id uuid references public.profiles (id) on delete cascade,
  add column if not exists read_at  timestamptz;

-- Constrain type to the finite set the app understands. Safe now: the table is
-- empty (generation ships in this migration).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_type_check') then
    alter table public.notifications
      add constraint notifications_type_check
      check (type in ('message', 'listing_saved'));
  end if;
end $$;

-- List query (newest-first per recipient) + unread-count hot path (partial
-- index, same shape as messages_receiver_unread_idx in 0008).
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read = false;

-- ── Trigger 1: new message → notify the recipient (never the sender) ────────
-- SECURITY DEFINER so it writes a row owned by the recipient even though the
-- INSERT was done by the sender. No is_blocked() check: messages_insert_sender
-- (0002) already forbids messaging across a block, so a message row only exists
-- for an unblocked pair. Dedup: one unread 'message' notification per
-- (recipient, sender, listing) — collapses a chatty thread to a single entry.
create or replace function public.notify_on_message()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.sender_id = new.receiver_id then
    return new;
  end if;
  if exists (
    select 1 from public.notifications
    where user_id = new.receiver_id
      and type = 'message'
      and actor_id = new.sender_id
      and listing_id is not distinct from new.listing_id
      and read = false
  ) then
    return new;
  end if;
  insert into public.notifications (user_id, type, actor_id, listing_id)
  values (new.receiver_id, 'message', new.sender_id, new.listing_id);
  return new;
end;
$$;

drop trigger if exists trg_notify_on_message on public.messages;
create trigger trg_notify_on_message
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- ── Trigger 2: listing saved → notify the owner (unless self-save/blocked) ──
-- Recipient is the listing's seller; actor is the saver. Skips a self-save and
-- skips when saver/owner blocked each other in either direction. Reads blocks
-- directly (definer context bypasses RLS) rather than via is_blocked(), which
-- is auth.uid()-gated and unreliable in a trigger. Same dedup as above.
create or replace function public.notify_on_saved_listing()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_owner uuid;
begin
  select seller_id into v_owner from public.listings where id = new.listing_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_owner and blocked_id = new.user_id)
       or (blocker_id = new.user_id and blocked_id = v_owner)
  ) then
    return new;
  end if;
  if exists (
    select 1 from public.notifications
    where user_id = v_owner
      and type = 'listing_saved'
      and actor_id = new.user_id
      and listing_id = new.listing_id
      and read = false
  ) then
    return new;
  end if;
  insert into public.notifications (user_id, type, actor_id, listing_id)
  values (v_owner, 'listing_saved', new.user_id, new.listing_id);
  return new;
end;
$$;

drop trigger if exists trg_notify_on_saved_listing on public.saved_listings;
create trigger trg_notify_on_saved_listing
  after insert on public.saved_listings
  for each row execute function public.notify_on_saved_listing();

-- ── RLS: fix the placeholder insert policy ──────────────────────────────────
-- 0002 shipped notifications_insert_own as an admitted placeholder. Rows are
-- now written only by the SECURITY DEFINER triggers above (which run as the
-- table owner and bypass RLS), so no client INSERT path should exist. Drop the
-- policy and revoke the 0005 INSERT grant so a client cannot fabricate rows.
drop policy if exists "notifications_insert_own" on public.notifications;
revoke insert on public.notifications from authenticated;

-- Mark-read is the only client write. Restrict the writable surface to the read
-- flag + timestamp (same column-grant pattern as messages.read_at in 0008);
-- notifications_select_own / _update_own / _delete_own from 0002 still scope by
-- owner.
revoke update on public.notifications from authenticated;
grant update (read, read_at) on public.notifications to authenticated;
