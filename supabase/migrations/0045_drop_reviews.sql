-- Axis — 0045: remove seller reviews.
--
-- Reviews (0020) are gone from the product: the app no longer reads, writes,
-- or reports them. This takes out the table and everything 0044 wired to it.
--
-- Order matters. reports.target_review_id has a foreign key to reviews, and
-- reports_queue joins reviews, so both have to let go before the table can
-- drop. The duplicate-report guard names target_review_id too, and a plpgsql
-- body is only checked when it runs, so leaving it alone would break every
-- future report insert rather than this migration.
--
-- IRREVERSIBLE: every review row is deleted. Reports that named a review are
-- kept, re-pointed at the review's author (see step 1).
-- ---------------------------------------------------------------------------

-- 1. Existing review reports. 0044 set target_user_id to the review's author
--    on every review report, so each one becomes a report on that person: the
--    moderation history survives, and a moderator can still act on the
--    account even though the text itself is gone. A row with no author
--    recorded names nothing once target_review_id drops, so it goes.
--
--    Neither trigger on reports (0036 rate limit, 0043 alert) fires on UPDATE,
--    so this sends no alert emails and trips no duplicate guard.
update public.reports
   set target_type = 'user',
       target_review_id = null
 where target_type = 'review'
   and target_user_id is not null;

delete from public.reports
 where target_type = 'review';

-- 2. The triage view, back to its pre-0044 columns. Same non-security_invoker
--    view, same revokes, same service_role grant (0043), same ordering.
--    report-alert reads only columns that survive.
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
grant select on public.reports_queue to service_role;

-- 3. The review target on reports. Dropping the column takes its foreign key
--    and 0044's index with it. The two checks go back to their 0011 shape.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports drop constraint if exists reports_target_present;

alter table public.reports drop column if exists target_review_id;

-- Mirrors ReportTarget (src/types/index.ts).
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user', 'listing', 'chat'));

alter table public.reports add constraint reports_target_present
  check (target_user_id is not null or target_listing_id is not null);

-- 4. The duplicate-report guard, without the column it can no longer compare.
--    Otherwise identical to 0044's definition.
create or replace function public.enforce_report_rate_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_today integer;
begin
  select count(*) into v_today
  from public.reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 day';

  if v_today >= 20 then
    raise exception 'You have filed too many reports today. If something urgent needs attention, email axis.app@outlook.com.';
  end if;

  if exists (
    select 1 from public.reports
    where reporter_id = new.reporter_id
      and status in ('open', 'reviewing')
      and target_type = new.target_type
      and target_user_id is not distinct from new.target_user_id
      and target_listing_id is not distinct from new.target_listing_id
  ) then
    raise exception 'You have already reported this. Our team is reviewing it and will respond within 24 hours.';
  end if;

  return new;
end;
$$;

-- 0036/0038: trigger functions keep no PostgREST RPC surface.
revoke all on function public.enforce_report_rate_limit() from public, anon, authenticated;

-- 5. The table itself. Dropping it also drops its RLS policies (0020, rewritten
--    in 0042), its index, its grants, and the content-filter trigger 0032
--    attached to it. The trigger's function is a separate object.
--
--    No CASCADE: steps 2 and 3 removed the only known dependents. Anything
--    else that still depends on reviews should fail this migration loudly, not
--    vanish silently along with the table.
drop table if exists public.reviews;

drop function if exists public.enforce_review_content();
