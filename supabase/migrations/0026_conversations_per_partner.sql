-- Axis — 0025: one conversation per person, not per (listing, person).
--
-- conversation_list (0009) bucketed threads by (listing_id, partner_id), so
-- messaging the same seller about two of their listings produced two separate
-- inbox rows and two separate chat threads — confusing on a campus app where
-- buyers and sellers know each other. The thread identity is now the partner
-- alone: one inbox row per person, carrying that person's newest message
-- (whose listing_id still provides the row's listing context) and the unread
-- count across all of their messages.
--
-- messages.listing_id is untouched — each message still records which listing
-- it was about; only the grouping changes. Column list and types are identical
-- to 0009, so create or replace keeps the existing grants
-- (authenticated select / anon revoked) intact.
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
  select distinct on (partner_id) *
  from mine
  order by partner_id, created_at desc
),
unread as (
  select sender_id as partner_id, count(*)::int as unread_count
  from mine
  where receiver_id = auth.uid() and read_at is null
  group by sender_id
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
  on u.partner_id = l.partner_id;
