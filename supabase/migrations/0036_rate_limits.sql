-- Axis — 0036: per-user throttles on the two unbounded abuse surfaces.
--
-- messages and reports both insert without any limit, so one account can flood
-- another student's inbox or bury the moderation queue in noise. That second
-- one matters more than it looks: CommunityGuidelinesScreen commits to a
-- 24-hour response on every report, and a queue anyone can spam makes that
-- promise unkeepable — which is the actual Guideline 1.2 exposure here, not the
-- raw insert volume.
--
-- Enforced the same way as the content filter (0032): BEFORE triggers in
-- Postgres, not client-side, so a modified client or a direct PostgREST call
-- can't skip them. Both raise messages the app can show verbatim — the screens'
-- catch blocks already surface error.message.
--
-- Limits are deliberately generous. They should be invisible to a student
-- haggling over a couch and immediately fatal to a script.

-- ---------------------------------------------------------------------------
-- Supporting indexes. Each trigger counts "this user's rows since T", and the
-- existing indexes are single-column (messages_sender_id_idx from 0001,
-- reports_reporter_id_idx from 0011) — usable, but they make the planner walk
-- every row the user has ever written to filter by time. These composites let
-- the count stop at the window boundary, which keeps the check O(rows in
-- window) rather than O(rows ever) as the table grows.
-- ---------------------------------------------------------------------------
create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Messages: 20 per minute, 300 per hour.
--
-- 20/min is roughly four times the fastest sustained human texting rate, so a
-- real conversation never touches it. The hourly cap catches the slow flood the
-- per-minute window would let through (19/min forever is 1,140/hour).
--
-- Counts by sender across all conversations rather than per-recipient: the
-- abuse we care about is one account spraying the marketplace, and a
-- per-recipient limit would let it hit 50 people at full rate each.
--
-- SECURITY DEFINER so the count sees every row the sender wrote. messages_select
-- (0002) scopes reads to the participant pair, so an invoker-rights count would
-- silently undercount from inside a trigger and the cap would never bind.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_rate_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_last_minute integer;
  v_last_hour   integer;
begin
  select count(*) into v_last_minute
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if v_last_minute >= 20 then
    raise exception 'You are sending messages too quickly. Wait a moment and try again.';
  end if;

  select count(*) into v_last_hour
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if v_last_hour >= 300 then
    raise exception 'You have sent too many messages in the past hour. Try again later.';
  end if;

  return new;
end;
$$;

-- Ordering note: 0032's trg_messages_content_filter and this trigger are both
-- BEFORE INSERT on messages, and Postgres fires same-timing triggers in name
-- order — trg_messages_content_filter before trg_messages_rate_limit. That is
-- the order we want: a user who trips both should be told what is wrong with
-- the message, not that they are going too fast.
drop trigger if exists trg_messages_rate_limit on public.messages;
create trigger trg_messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- Reports: 20 per day, and no duplicate open report against the same target.
--
-- The daily cap bounds the queue; the duplicate check is what actually keeps it
-- readable. Without it a single user can file the same complaint against one
-- seller 20 times a day and a moderator triages 20 rows to learn one fact.
-- Scoped to open/reviewing so a genuinely repeated offence can be re-reported
-- once the earlier report has been resolved or dismissed.
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
    raise exception 'You have already reported this. Our team is reviewing it and will respond within 24 hours.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_rate_limit on public.reports;
create trigger trg_reports_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();

-- Trigger execution doesn't consult the invoking user's EXECUTE privilege, so
-- these revokes only remove the pointless PostgREST RPC surface — same
-- reasoning as the enforce_*_content functions in 0032.
revoke all on function public.enforce_message_rate_limit() from public, anon, authenticated;
revoke all on function public.enforce_report_rate_limit() from public, anon, authenticated;
