-- Axis — 0046: stop promising a 24-hour response to reports.
--
-- The Terms, the Community Guidelines and one database error message all told
-- users a report would be answered within 24 hours. That commitment is
-- withdrawn: the app now says reports are reviewed, without a clock, and the
-- reporter gets a confirmation email instead (report-alert, no schema change).
--
-- The screens change in the app. The one place the promise lives in Postgres
-- is the duplicate-report message in enforce_report_rate_limit(), which the
-- app shows verbatim. This redefines the function with only that string
-- changed; the body is otherwise identical to 0045's.
-- ---------------------------------------------------------------------------

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
    raise exception 'You have already reported this. Our team is reviewing it.';
  end if;

  return new;
end;
$$;

-- 0036/0038: trigger functions keep no PostgREST RPC surface.
revoke all on function public.enforce_report_rate_limit() from public, anon, authenticated;

-- 0043's comment described the alert as backing the 24-hour promise.
comment on function public.notify_new_report() is
  'AFTER INSERT on reports: posts the report id to the report-alert edge function, which emails the moderator and sends the reporter a confirmation. Never blocks the insert.';
