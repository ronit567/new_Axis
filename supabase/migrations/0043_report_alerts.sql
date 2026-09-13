-- Axis — 0043: alert on a new report.
--
-- The Terms and the Community Guidelines both promise a decision within 24
-- hours, and docs/MODERATION.md commits one person to two checks a day. Until
-- now nothing told that person a report existed: reports landed in
-- public.reports and were seen only if someone opened Studio. A published SLA
-- with no notification path is the gap App Review cites under 1.2, and it is a
-- real safety gap regardless of Apple.
--
-- This is the Database Webhook from the audit, written as a migration instead
-- of a dashboard toggle so it is reviewable, diffable, and survives the project
-- being rebuilt. Supabase's own webhooks are exactly this: a trigger calling
-- pg_net.
--
-- Configuration lives in Vault, not here, so no secret enters git:
--
--   select vault.create_secret('https://<ref>.functions.supabase.co/report-alert',
--                              'report_alert_url');
--   select vault.create_secret('<a long random string>', 'report_alert_secret');
--
-- The same random string goes to the edge function as REPORT_ALERT_SECRET.
-- With either secret absent the trigger warns and does nothing — reports still
-- file normally.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

-- The alerter reads the joined row, not the bare NEW record, so the email can
-- name the reporter, the target, and the listing without a second lookup.
-- 0012 revoked the view from everyone; service_role holds no SELECT on it (or
-- on the tables beneath), which is why moderation has been Studio-only. The
-- view is not security_invoker, so granting the view alone exposes exactly the
-- triage columns and no direct table access.
grant select on public.reports_queue to service_role;

create or replace function public.notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'report_alert_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'report_alert_secret';

  if v_url is null or v_secret is null then
    raise warning 'notify_new_report: vault secrets missing; no alert sent for report %', new.id;
    return new;
  end if;

  -- net.http_post queues the request and returns immediately, so filing a
  -- report never waits on the network.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-axis-alert-secret', v_secret
               ),
    body    := jsonb_build_object('report_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception
  -- Alerting must never cost a user the ability to report something. Any
  -- failure is logged and swallowed; the insert still commits.
  when others then
    raise warning 'notify_new_report: alert failed for report % (%)', new.id, sqlerrm;
    return new;
end;
$$;

comment on function public.notify_new_report() is
  'AFTER INSERT on reports: posts the report id to the report-alert edge function so the 24-hour triage promise has a notification path. Never blocks the insert.';

-- 0038: trigger functions are not callable by the app roles.
revoke all on function public.notify_new_report() from public, anon, authenticated;

-- AFTER, so it runs behind trg_reports_rate_limit (0036, BEFORE INSERT): a
-- report rejected by the rate limiter never reaches this trigger, and so never
-- generates an alert email. Spam cannot be turned into a mail flood.
drop trigger if exists reports_notify_new on public.reports;
create trigger reports_notify_new
  after insert on public.reports
  for each row
  execute function public.notify_new_report();
