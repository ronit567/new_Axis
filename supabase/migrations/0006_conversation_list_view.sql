-- Conversation inbox view (AX-113). One row per (listing, partner) thread for
-- the calling user: the thread's last message columns plus its unread count.
-- Replaces the client-side newest-400-messages scan in getConversations, whose
-- known wart was threads falling off the inbox once their entire history aged
-- past the scan window.
--
-- security_invoker (PG15+): the view runs under the caller's RLS on messages,
-- so participant scoping and post-block visibility semantics are inherited
-- from the table policies — no policies needed on the view itself.

create view public.conversation_list
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
  -- together here, so no-listing threads (SellerProfile chats) bucket exactly
  -- like the client-side reducer did.
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
 and u.listing_id is not distinct from l.listing_id;

-- anon would only ever see zero rows (auth.uid() is null and the underlying
-- RLS denies it anyway), but revoke to keep the surface explicit.
revoke all on public.conversation_list from anon;
grant select on public.conversation_list to authenticated;
