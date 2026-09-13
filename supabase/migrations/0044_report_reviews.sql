-- Axis — 0044: reports can name a review.
--
-- Reviews are user-written text displayed on someone else's profile, which is
-- a classic harassment surface, and they were the one piece of user-generated
-- content with no individual report path: a reader could report the *author*
-- through their profile, but not the review itself, and the person the review
-- is about could do nothing at all about a review sitting on their own page.
--
-- The author-side half needs no migration — 0020 already ships
-- reviews_delete_reviewer and the DELETE grant. Only the client was missing.
-- ---------------------------------------------------------------------------

alter table public.reports
  add column if not exists target_review_id uuid
    references public.reviews (id) on delete cascade;

comment on column public.reports.target_review_id is
  'The reported review. Set only for target_type = ''review'', which also sets target_user_id to the review''s author so a moderator can act on the person without a second lookup.';

-- Mirrors ReportTarget (src/types/index.ts), now four entry points.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user', 'listing', 'chat', 'review'));

-- A report still has to name something. Widened rather than replaced: the two
-- existing columns keep their meaning.
alter table public.reports drop constraint if exists reports_target_present;
alter table public.reports add constraint reports_target_present
  check (
    target_user_id is not null
    or target_listing_id is not null
    or target_review_id is not null
  );

create index if not exists reports_target_review_id_idx
  on public.reports (target_review_id);

-- 0012's triage view, extended so a review report reads without a join by
-- hand. Rebuilt rather than altered: a view's column list can only grow at the
-- end with CREATE OR REPLACE, and the new columns belong beside the other
-- target columns. Same non-security_invoker, same revokes, same ordering.
drop view if exists public.reports_queue;

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
  l.seller_id         as target_listing_seller_id,
  r.target_review_id,
  rev.body            as target_review_body,
  rev.rating          as target_review_rating,
  rev.seller_id       as target_review_seller_id
from public.reports r
left join public.profiles reporter       on reporter.id = r.reporter_id
left join auth.users      reporter_auth  on reporter_auth.id = r.reporter_id
left join public.profiles target_profile on target_profile.id = r.target_user_id
left join auth.users      target_auth    on target_auth.id = r.target_user_id
left join public.listings l              on l.id = r.target_listing_id
left join public.reviews  rev            on rev.id = r.target_review_id
-- Open reports first, then most recent — the natural triage order.
order by (r.status = 'open') desc, r.created_at desc;

revoke all on public.reports_queue from public, anon, authenticated;
-- 0043: the alerter reads the view, and only the view.
grant select on public.reports_queue to service_role;
