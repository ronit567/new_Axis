// Axis — report-alert.
//
// Called by the reports_notify_new trigger (migration 0043) on every INSERT
// into public.reports. Reads the joined row out of reports_queue and sends two
// emails:
//
//   1. an alert to whoever owns the moderation queue, so a report doesn't wait
//      for someone to open Studio;
//   2. a confirmation to the reporter, so they know it arrived. Its Reply-To is
//      the moderation mailbox, so "I have more to add" reaches a person.
//
// The two sends are independent: a failed confirmation never costs the
// moderator their alert, and the reverse. Neither is retried.
//
// Auth is a shared secret, not a JWT: the caller is Postgres, and the anon key
// is in every copy of the app, so verify_jwt would gate this on a value an
// attacker already has. Deploy with --no-verify-jwt.
//
// Secrets (supabase secrets set):
//   REPORT_ALERT_SECRET       same random string as the report_alert_secret vault entry
//   RESEND_API_KEY            https://resend.com — free tier covers this volume
//   REPORT_ALERT_TO           moderator mailbox        (default axis.app@outlook.com)
//   REPORT_ALERT_FROM         verified Resend sender   (default alerts@dataaxis.org)
//   REPORT_CONFIRMATION_FROM  verified Resend sender   (default reports@dataaxis.org)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildAlertEmail, buildConfirmationEmail, type Email, type QueueRow } from './email.ts';

const ALERT_SECRET = Deno.env.get('REPORT_ALERT_SECRET');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALERT_TO = Deno.env.get('REPORT_ALERT_TO') ?? 'axis.app@outlook.com';
const ALERT_FROM = Deno.env.get('REPORT_ALERT_FROM') ?? 'Axis alerts <alerts@dataaxis.org>';
const CONFIRMATION_FROM =
  Deno.env.get('REPORT_CONFIRMATION_FROM') ?? 'Axis <reports@dataaxis.org>';

// Constant-time-ish compare so a wrong secret can't be probed byte by byte.
function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// One Resend call. Resolves to whether it was accepted; failures are logged
// here so the caller only has to decide the response status.
async function send(
  label: string,
  reportId: string,
  message: Email & { from: string; to: string; replyTo?: string },
): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`report-alert: ${label} send failed for ${reportId} (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error(`report-alert: ${label} send threw for ${reportId}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  if (!ALERT_SECRET || !RESEND_API_KEY) {
    console.error('report-alert: REPORT_ALERT_SECRET or RESEND_API_KEY is not set');
    return new Response('not configured', { status: 500 });
  }
  if (!secretMatches(req.headers.get('x-axis-alert-secret'), ALERT_SECRET)) {
    return new Response('forbidden', { status: 403 });
  }

  let reportId: string | undefined;
  try {
    reportId = (await req.json())?.report_id;
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!reportId) return new Response('missing report_id', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 0043 grants service_role SELECT on this view specifically; it still holds
  // no SELECT on reports, listings or profiles.
  const { data, error } = await supabase
    .from('reports_queue')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error || !data) {
    console.error(`report-alert: could not read report ${reportId}:`, error?.message);
    return new Response('report not found', { status: 404 });
  }

  const row = data as QueueRow;

  // Logged, not retried: a dropped alert must not wedge the queue. The
  // twice-daily Studio check in MODERATION.md is the backstop.
  const alerted = await send('alert', reportId, {
    ...buildAlertEmail(row),
    from: ALERT_FROM,
    to: ALERT_TO,
  });

  // 0036 caps a reporter at 20 reports a day, and this only ever goes to the
  // reporter's own verified address, so it can't be turned into a way to mail
  // someone else.
  const confirmation = buildConfirmationEmail(row);
  const confirmed = confirmation
    ? await send('confirmation', reportId, {
        ...confirmation,
        from: CONFIRMATION_FROM,
        to: row.reporter_email!,
        replyTo: ALERT_TO,
      })
    : true;
  if (!confirmation) {
    console.log(`report-alert: no reporter email on report ${reportId}; confirmation skipped`);
  }

  if (!alerted || !confirmed) {
    const failed = [!alerted && 'alert', !confirmed && 'confirmation'].filter(Boolean).join(' and ');
    return new Response(`${failed} failed`, { status: 502 });
  }

  console.log(
    `report-alert: alerted on report ${reportId}${confirmation ? ' and confirmed to the reporter' : ''}`,
  );
  return new Response('ok', { status: 200 });
});
