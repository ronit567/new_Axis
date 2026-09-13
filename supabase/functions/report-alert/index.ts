// Axis — report-alert.
//
// Called by the reports_notify_new trigger (migration 0043) on every INSERT
// into public.reports. Reads the joined row out of reports_queue and emails it
// to whoever owns the moderation queue, so the 24-hour promise in the Terms and
// the Community Guidelines has something behind it.
//
// Auth is a shared secret, not a JWT: the caller is Postgres, and the anon key
// is in every copy of the app, so verify_jwt would gate this on a value an
// attacker already has. Deploy with --no-verify-jwt.
//
// Secrets (supabase secrets set):
//   REPORT_ALERT_SECRET  same random string as the report_alert_secret vault entry
//   RESEND_API_KEY       https://resend.com — free tier covers this volume
//   REPORT_ALERT_TO      moderator mailbox        (default axis.app@outlook.com)
//   REPORT_ALERT_FROM    verified Resend sender   (default alerts@dataaxis.org)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALERT_SECRET = Deno.env.get('REPORT_ALERT_SECRET');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALERT_TO = Deno.env.get('REPORT_ALERT_TO') ?? 'axis.app@outlook.com';
const ALERT_FROM = Deno.env.get('REPORT_ALERT_FROM') ?? 'Axis alerts <alerts@dataaxis.org>';

type QueueRow = {
  id: string;
  created_at: string;
  status: string;
  reason: string;
  target_type: string;
  reporter_name: string | null;
  reporter_email: string | null;
  target_user_name: string | null;
  target_user_email: string | null;
  target_listing_title: string | null;
  target_listing_id: string | null;
  target_user_id: string | null;
};

// Constant-time-ish compare so a wrong secret can't be probed byte by byte.
function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  prohibited_item: 'Prohibited item',
  harassment: 'Harassment',
  other: 'Other',
};

// MODERATION.md escalates threats and anything touching a minor immediately,
// outside the twice-daily check. Surfacing that in the subject is what makes
// the distinction actionable from a phone lock screen.
function isUrgent(row: QueueRow): boolean {
  return row.reason === 'harassment';
}

function buildEmail(row: QueueRow) {
  const reason = REASON_LABEL[row.reason] ?? row.reason;
  const target =
    row.target_type === 'listing'
      ? `listing "${row.target_listing_title ?? '(untitled)'}"`
      : `user ${row.target_user_name ?? '(unknown)'}`;

  const subject = `${isUrgent(row) ? '[urgent] ' : ''}Axis report: ${reason} — ${target}`;

  const lines = [
    `A new report was filed on Axis.`,
    ``,
    `Reason:      ${reason}`,
    `Target type: ${row.target_type}`,
    `Filed:       ${row.created_at}`,
    ``,
    `Reporter:    ${row.reporter_name ?? '(unknown)'} <${row.reporter_email ?? 'n/a'}>`,
    `Target user: ${row.target_user_name ?? 'n/a'} <${row.target_user_email ?? 'n/a'}>`,
    row.target_listing_title ? `Listing:     ${row.target_listing_title}` : null,
    ``,
    `Report id:   ${row.id}`,
    row.target_listing_id ? `Listing id:  ${row.target_listing_id}` : null,
    row.target_user_id ? `User id:     ${row.target_user_id}` : null,
    ``,
    `Triage it in Studio:`,
    `  select * from public.reports_queue where id = '${row.id}';`,
    ``,
    `The published commitment is a decision within 24 hours. The runbook is`,
    `docs/MODERATION.md.`,
  ].filter((l) => l !== null);

  return { subject, text: lines.join('\n') };
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

  const { subject, text } = buildEmail(data as QueueRow);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_TO], subject, text }),
  });

  if (!res.ok) {
    // Logged, not retried: a dropped alert must not wedge the queue. The
    // twice-daily Studio check in MODERATION.md is the backstop.
    console.error(`report-alert: send failed for ${reportId} (${res.status}):`, await res.text());
    return new Response('send failed', { status: 502 });
  }

  console.log(`report-alert: alerted on report ${reportId}`);
  return new Response('ok', { status: 200 });
});
