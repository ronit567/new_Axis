-- Axis — 0051: a conversation is a (listing, person) pair, and deleting a
-- listing no longer deletes the conversation about it.
--
-- SUPERSEDES 0026 (which itself superseded 0009's grouping). 0026 collapsed the
-- inbox to one row per person, on the theory that a campus marketplace is small
-- enough that two people hold one running conversation. Living with it showed
-- the opposite: the thing being sold *is* the subject of the chat. Messaging
-- the same seller about their desk lamp and their calculus textbook produced
-- one merged thread whose inbox row showed only the newest message's listing,
-- so the other conversation had no row of its own, no unread count of its own,
-- and "Is this still available?" could not be told apart. The same merge made
-- the inbox label the *person* — the only thing the two conversations had in
-- common — which is why MessagesScreen showed a name where a buyer expects to
-- see what they were asking about.
--
-- So the grouping key goes back to (listing_id, partner_id), which is exactly
-- 0009's shape. 0009's header comment already describes this view correctly and
-- is worth reading; this file restores its body verbatim apart from the comments
-- below. Nothing about 0009's rationale (server-side bucketing instead of a
-- client-side newest-400 scan; security_invoker so the caller's RLS on
-- public.messages supplies participant scoping) has changed.
--
-- ORDERING / DEPENDENCIES
--   * Must run after 0009 (creates the view), 0026 (last replaced it) and 0008
--     (adds messages.read_at, which the view selects and counts). It is a
--     CREATE OR REPLACE with a column list identical to both predecessors, so
--     the 0009 grants — select to authenticated, revoked from anon — survive
--     untouched and are not restated here.
--   * Touches no policy. messages_select_participant (0002),
--     messages_insert_sender (0025, which carries the is_blocked() gate and the
--     no-self check) and messages_update_receiver_read (0008) are unchanged, as
--     is the column-level `grant update (read_at)` that keeps a receiver's
--     write surface to the read receipt alone. Blocking behaviour is likewise
--     untouched: is_blocked() hides the partner's *profile*, and
--     MessageRepository.getConversations drops any thread whose partner it
--     cannot hydrate — that is unaffected by how threads are bucketed.
--   * Must run after 0049, which is where messages_listing_id_idx is discussed;
--     that index (0001) is still present and is what keeps the FK rewrite below
--     from turning every listing delete into a sequential scan of messages.
--
-- NO NEW COLUMN, NO BACKFILL
-- messages.listing_id has existed since 0001 and was never dropped — 0026
-- explicitly left it alone and regrouped only the view, so every message ever
-- written still records the listing it was sent about. There is nothing to add
-- and nothing to backfill; the history simply re-buckets along a column that
-- was always populated.
--
-- One honest caveat about that re-bucketing. While 0026 was live the inbox
-- handed ChatScreen the *newest* message's listing as the thread's context, and
-- ChatScreen stamped that listing onto everything sent from there. So a reply
-- typed into a merged thread carries whichever listing happened to be newest at
-- the time, which is not always the listing the reply was about. Those rows
-- will land in that listing's thread now. This migration does not try to
-- re-attribute them: there is no signal in the data to do it from, and guessing
-- would move real messages between real conversations. The visible effect is
-- limited to users who messaged one person about two listings during 0026's
-- lifetime, and it is self-correcting as the conversation continues.
--
-- ON DELETE: CASCADE -> SET NULL
-- 0001 declared `listing_id uuid references public.listings (id) on delete
-- cascade` inline, so Postgres named it messages_listing_id_fkey. Under
-- per-partner grouping that cascade was merely lossy; under per-listing
-- grouping it decides what a thread *is*, so it has to be chosen deliberately.
--
-- Deleting a listing is a normal, unremarkable, one-tap action in this app:
-- ListingDetailScreen offers "Delete listing?" and
-- ListingRepository.deleteListing hard-deletes the row. With CASCADE, a seller
-- tidying up after a sale silently destroys the buyer's half of the
-- conversation too — the where-and-when of the handoff, what was agreed, the
-- whole thread, gone from someone else's phone without their say. Worse, it is
-- a one-tap evidence shredder: a seller who has just been reported under 0043's
-- alerting can delete the listing and take the chat that proves the report with
-- it, from the reporter's device and from any moderator's view alike.
--
-- SET NULL keeps the message rows. The cost is that a thread whose listing is
-- deleted loses its identity and falls into the same "no listing" bucket as
-- every other listing-less thread with that person — so two deleted listings
-- with the same partner merge into one thread. That is accepted knowingly: it
-- is a cosmetic merge in a rare case, and the alternative is deleting other
-- people's messages. The client already renders that bucket sensibly, falling
-- back to the partner's name when there is no listing to name the row with.
--
-- Two alternatives were considered and rejected:
--   * Keep CASCADE. Rejected for the two reasons above; "this can't be undone"
--     in the delete confirmation is a promise about the seller's listing, not a
--     licence to delete a second person's messages.
--   * Add a second, FK-free thread-key column that keeps the original listing
--     id after the listing row dies, so threads stay distinct forever. Rejected
--     as two columns for one concept: they can only drift, and the merge it
--     prevents is not worth a denormalised copy of a foreign key on the
--     busiest table in the schema.
--
-- Account deletion is unaffected. delete_own_account() removes the profile,
-- which cascades to that user's listings; the messages in those threads are
-- still removed, not orphaned, because messages.sender_id and
-- messages.receiver_id both cascade from profiles and a listing's thread is by
-- construction between its seller and a buyer. The only rows this FK now spares
-- are ones where neither party is the deleted account, which the messaging
-- model cannot produce.
-- ---------------------------------------------------------------------------

-- Guarded on confdeltype so a re-run is a no-op rather than a duplicate-
-- constraint error. 'c' = CASCADE (what 0001 left), 'n' = SET NULL (what we
-- want); anything else also gets rewritten, since this file is the authority
-- on what that FK does.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'messages_listing_id_fkey'
      and conrelid = 'public.messages'::regclass
      and confdeltype <> 'n'
  ) then
    alter table public.messages drop constraint messages_listing_id_fkey;
    alter table public.messages
      add constraint messages_listing_id_fkey
      foreign key (listing_id) references public.listings (id)
      on delete set null;
  end if;
end $$;

comment on constraint messages_listing_id_fkey on public.messages is
  'ON DELETE SET NULL (0051): deleting a listing must not delete the other party''s copy of the conversation. The thread falls back to the partner''s listing-less bucket.';

-- The inbox view, regrouped. Column list and types are identical to 0009/0026,
-- so CREATE OR REPLACE keeps the existing grants intact.
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
  -- listing was deleted and nulled by the FK above — is one row, not one per
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
 and u.listing_id is not distinct from l.listing_id;

comment on view public.conversation_list is
  'One inbox row per (listing, partner) thread for the calling user: the thread''s newest message plus its unread count. Regrouped per listing by 0051, superseding 0026''s per-partner grouping.';
