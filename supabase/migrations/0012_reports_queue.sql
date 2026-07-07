-- Axis — reports triage view (AX-707, builds on AX-703's reports table in 0011).
--
-- The compliance requirement (Guideline 1.2 for UGC apps) asks that reports
-- land in a "queryable queue (SQL view/dashboard OK for v1)". The reports table
-- (0011) already stores them with a `status` column, but a reviewer working the
-- queue would have to hand-join four tables to see who reported whom (names +
-- emails to actually contact or action a party). This view does those joins
-- once so a reviewer can `select * from reports_queue where status = 'open'`
-- and act on a row without a second lookup.
--
-- Deliberately NOT security_invoker: a reviewer must see EVERY report, which
-- reports_select_own (0011, reporter-only) would not allow. Running as the view
-- owner reads across all rows. There are no grants to anon/authenticated below,
-- so the only path to it is the Supabase Studio SQL editor / a service_role
-- connection — never the app API. There is no in-app moderation surface in v1.
create view public.reports_queue as
select
  r.id,
  r.created_at,
  r.status,
  r.reason,
  r.target_type,
  r.reporter_id,
  reporter.name       as reporter_name,
  reporter_auth.email as reporter_email,
  r.target_user_id,
  target_profile.name as target_user_name,
  target_auth.email   as target_user_email,
  r.target_listing_id,
  l.title             as target_listing_title,
  l.seller_id         as target_listing_seller_id
from public.reports r
left join public.profiles reporter       on reporter.id = r.reporter_id
left join auth.users      reporter_auth  on reporter_auth.id = r.reporter_id
left join public.profiles target_profile on target_profile.id = r.target_user_id
left join auth.users      target_auth    on target_auth.id = r.target_user_id
left join public.listings l              on l.id = r.target_listing_id
-- Open reports first, then most recent — the natural triage order.
order by (r.status = 'open') desc, r.created_at desc;

revoke all on public.reports_queue from public, anon, authenticated;
