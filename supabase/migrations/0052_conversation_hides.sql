-- Axis — 0052: a user can delete a conversation from their own inbox.
--
-- There was no way to clear a thread. A one-line "is this still available?"
-- that went nowhere sat in the inbox forever, and an inbox that cannot be
-- tidied stops being read — which matters here, because the same list carries
-- the messages a sale actually depends on.
--
-- DELETING IS PER-USER, AND IS NOT A DELETE OF THE MESSAGES.
--
-- The obvious implementation — delete the rows — is wrong, for the same reason
-- 0051 changed the listing FK to ON DELETE SET NULL rather than CASCADE. A
-- conversation has two participants and the rows are equally the other
-- person's. One side pressing delete must not reach into the other side's
-- phone and remove a conversation they may be relying on, or may be about to
-- report. 0043 alerts a moderator on every report and docs/MODERATION.md has
-- the moderator read the reported content out of the queue; if a report could
-- be answered by deleting the evidence, that process would be decorative.
--
-- So "delete" records a per-user timestamp and the view filters on it. Nothing
-- leaves public.messages. A moderator reading the queue as `postgres` sees the
-- thread exactly as it was, whoever has hidden it.
--
-- A NEWER MESSAGE BRINGS THE THREAD BACK. The view compares the thread's
-- newest message against hidden_at, so hiding is a statement about the
-- conversation *so far*, not a mute. This is how every mainstream messenger
-- behaves and it is the behaviour that fails safe: the alternative silently
-- swallows an incoming message, and a buyer who never learns the seller
-- replied is a worse outcome than a thread reappearing. Blocking, not
-- deleting, is the tool for "never hear from this person again" (0033), and it
-- is reachable from the same screens.
--
-- Deleting again after the thread returns simply moves hidden_at forward.
--
-- ORDERING / DEPENDENCIES
--   * Must run after 0051, whose (listing_id, partner_id) grouping this view
--     body extends. Re-stating the whole view is unavoidable: CREATE OR
--     REPLACE cannot add a WHERE clause without restating the body, and the
--     column list is identical to 0009/0026/0051 so the 0009 grants (select to
--     authenticated, revoked from anon) survive untouched.
--   * Must run after 0033 (blocks) only in the sense that the two are
--     complementary; no object here depends on it.
--   * Touches no policy on public.messages. Participant scoping still comes
--     from messages_select_participant (0002) through security_invoker.

create table if not exists public.conversation_hides (
  user_id     uuid not null references auth.users (id) on delete cascade,
  partner_id  uuid not null references auth.users (id) on delete cascade,

  -- Nullable, and nullable deliberately: 0051 buckets every listing-less
  -- thread with one person into a single row keyed by a null listing_id, and a
  -- hide has to be able to name that bucket.
  --
  -- ON DELETE CASCADE, not SET NULL. 0051 nulls messages.listing_id when a
  -- listing goes, moving that thread into the null bucket — and if this column
  -- were SET NULL too, a user who had hidden both the listing thread and the
  -- null-bucket thread would have two rows collapse onto the same key, and the
  -- unique constraint below would abort the listing delete. Dropping the hide
  -- instead means a deleted listing's thread reappears in the inbox once. That
  -- is the correct failure direction: a thread that comes back is visible and
  -- can be deleted again, whereas a listing that cannot be deleted is a dead
  -- end the user cannot resolve.
  listing_id  uuid references public.listings (id) on delete cascade,

  hidden_at   timestamptz not null default now(),

  -- NULLS NOT DISTINCT (PG15+; this project is on 17) so the null-listing
  -- bucket gets exactly one row per partner. Under the default NULLS DISTINCT
  -- every hide of a listing-less thread would insert a new row instead of
  -- updating, the upsert below would never match, and hidden_at would never
  -- move forward.
  constraint conversation_hides_pkey
    unique nulls not distinct (user_id, partner_id, listing_id)
);

comment on table public.conversation_hides is
  'Per-user "deleted this conversation" marks. Hides a (listing, partner) thread from that user''s inbox up to hidden_at; a newer message brings it back. Never removes rows from public.messages — the other participant, and moderation, still see the thread in full.';

-- The view joins this per row of the inbox, always filtered to auth.uid().
create index if not exists conversation_hides_user_idx
  on public.conversation_hides (user_id);

alter table public.conversation_hides enable row level security;

-- Your own marks, and only your own. There is no policy for reading anyone
-- else's: whether someone has cleared their inbox is not information the other
-- participant is entitled to, and leaking it would turn a tidy-up into a
-- social signal ("they deleted our chat").
drop policy if exists conversation_hides_select_own on public.conversation_hides;
create policy conversation_hides_select_own
  on public.conversation_hides for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists conversation_hides_insert_own on public.conversation_hides;
create policy conversation_hides_insert_own
  on public.conversation_hides for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE is what the upsert lands on when a thread is deleted a second time.
drop policy if exists conversation_hides_update_own on public.conversation_hides;
create policy conversation_hides_update_own
  on public.conversation_hides for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists conversation_hides_delete_own on public.conversation_hides;
create policy conversation_hides_delete_own
  on public.conversation_hides for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- `(select auth.uid())` rather than a bare call, per 0042: the scalar
-- subquery is evaluated once per statement instead of once per row.

revoke all on public.conversation_hides from anon, public;
grant select, insert, update, delete on public.conversation_hides to authenticated;

-- ---------------------------------------------------------------------------
-- conversation_list: 0051's body, plus the hide filter.
-- ---------------------------------------------------------------------------
create or replace view public.conversation_list
  with (security_invoker = true) as
with mine as (
  select m.*,
         case when m.sender_id = auth.uid() then m.receiver_id
              else m.sender_id
         end as partner_id
  from public.messages m
  where m.sender_id = auth.uid() or m.receiver_id = auth.uid()
),
last_msg as (
  -- DISTINCT ON picks the newest row per thread. Null listing_ids group
  -- together here, so every listing-less thread with one person — a chat
  -- opened from a notification that carried no listing, or a thread whose
  -- listing was deleted and nulled by 0051's FK — is one row, not one per
  -- message.
  select distinct on (listing_id, partner_id) *
  from mine
  order by listing_id, partner_id, created_at desc
),
unread as (
  select listing_id, sender_id as partner_id, count(*)::int as unread_count
  from mine
  where receiver_id = auth.uid() and read_at is null
  group by listing_id, sender_id
)
select
  l.id,
  l.listing_id,
  l.sender_id,
  l.receiver_id,
  l.body,
  l.created_at,
  l.read_at,
  l.partner_id,
  coalesce(u.unread_count, 0) as unread_count
from last_msg l
left join unread u
  on u.partner_id = l.partner_id
 -- IS NOT DISTINCT FROM, not `=`: the listing-less bucket has a null key on
 -- both sides, and `null = null` would drop its unread count on the floor.
 and u.listing_id is not distinct from l.listing_id
left join public.conversation_hides h
  on h.user_id = auth.uid()
 and h.partner_id = l.partner_id
 and h.listing_id is not distinct from l.listing_id
-- No hide, or the thread has moved on since it was hidden. LEFT JOIN + IS NULL
-- rather than NOT EXISTS so the timestamp is available to compare in the same
-- pass.
where h.hidden_at is null or l.created_at > h.hidden_at;

comment on view public.conversation_list is
  'One inbox row per (listing, partner) thread for the calling user: the thread''s newest message plus its unread count. Regrouped per listing by 0051; rows the user has deleted are filtered by 0052 until a newer message arrives.';
