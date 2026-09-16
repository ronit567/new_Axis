// Axis — report-alert email content.
//
// Pure functions only: no Deno globals, no network, no env. index.ts decides
// who receives what and sends it; this file decides what the messages say, so
// email_test.ts can pin that down with `deno test`.

// The reports_queue columns the emails read. 0045 is the current shape.
export type QueueRow = {
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

export type Email = { subject: string; text: string; html?: string };

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  prohibited_item: 'Prohibited item',
  harassment: 'Harassment',
  other: 'Other',
};

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

// MODERATION.md escalates threats and anything touching a minor immediately,
// outside the twice-daily check. Surfacing that in the subject is what makes
// the distinction actionable from a phone lock screen.
function isUrgent(row: QueueRow): boolean {
  return row.reason === 'harassment';
}

// ── To the moderator ────────────────────────────────────────────────────────

export function buildAlertEmail(row: QueueRow): Email {
  const reason = reasonLabel(row.reason);
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
    `The runbook is docs/MODERATION.md.`,
  ].filter((l) => l !== null);

  return { subject, text: lines.join('\n') };
}

// ── To the reporter ─────────────────────────────────────────────────────────
//
// What this email must not do: promise a response time, promise to report
// back an outcome, or tell the reporter anything they didn't already know.
// Names and titles below are ones the reporter saw on screen when they filed.

// The first word of a display name, for "Hi Ronit". Falls back rather than
// guessing when there is nothing usable.
function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

// What was reported, phrased the way the reporter would recognise it.
function describeTarget(row: QueueRow): string {
  switch (row.target_type) {
    case 'listing':
      return row.target_listing_title
        ? `the listing “${row.target_listing_title}”`
        : 'a listing';
    case 'chat':
      return row.target_user_name
        ? `your conversation with ${row.target_user_name}`
        : 'a conversation';
    default:
      return row.target_user_name ? `${row.target_user_name}'s profile` : 'a profile';
  }
}

// A short, readable handle for a reply ("my report 3F2A9C1D"). The full uuid
// is still in the moderator's copy.
export function reportReference(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

// Axis is a Western University app, so filing times read in Eastern time.
function formatFiled(createdAt: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  }).format(new Date(createdAt));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Returns null when the reporter has no email on file — the account was
// deleted between filing and this running — since there is no one to confirm to.
export function buildConfirmationEmail(row: QueueRow): Email | null {
  if (!row.reporter_email) return null;

  const name = firstName(row.reporter_name);
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const target = describeTarget(row);
  const reason = reasonLabel(row.reason);
  const reference = reportReference(row.id);
  const filed = formatFiled(row.created_at);

  const subject = 'We received your report';

  const text = [
    greeting,
    ``,
    `Thanks for reporting ${target} on Axis. Your report reached our moderation team, and we'll review it against our Community Guidelines.`,
    ``,
    `Reason:    ${reason}`,
    `Filed:     ${filed}`,
    `Reference: ${reference}`,
    ``,
    `You don't need to do anything else. Reports are confidential: the person you reported isn't told who filed it.`,
    ``,
    `If you have more to add, reply to this email.`,
    ``,
    `If you or someone else is in immediate danger, call 911.`,
    ``,
    `— The Axis team`,
    ``,
    `You're receiving this because a report was filed on Axis from ${row.reporter_email}.`,
  ].join('\n');

  const e = escapeHtml;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F8F8F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8F8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#5C2D91;padding:28px 32px;">
                <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Axis</h1>
                <p style="margin:4px 0 0;color:#DDD0F5;font-size:13px;">The Western student marketplace</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 10px;color:#1A1A2E;font-size:19px;font-weight:700;">We received your report</h2>
                <p style="margin:0 0 16px;color:#6B6B7B;font-size:15px;line-height:22px;">${e(greeting)}</p>
                <p style="margin:0 0 24px;color:#6B6B7B;font-size:15px;line-height:22px;">
                  Thanks for reporting ${e(target)} on Axis. Your report reached our moderation team,
                  and we'll review it against our Community Guidelines.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEFF;border:1px solid #DDD0F5;border-radius:10px;">
                  <tr>
                    <td style="padding:16px 20px;color:#1A1A2E;font-size:14px;line-height:24px;">
                      <strong>Reason:</strong> ${e(reason)}<br>
                      <strong>Filed:</strong> ${e(filed)}<br>
                      <strong>Reference:</strong> <span style="font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:1px;">${e(reference)}</span>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;color:#6B6B7B;font-size:15px;line-height:22px;">
                  You don't need to do anything else. Reports are confidential: the person you
                  reported isn't told who filed it. If you have more to add, reply to this email.
                </p>
                <p style="margin:16px 0 0;color:#1A1A2E;font-size:14px;line-height:20px;font-weight:600;">
                  If you or someone else is in immediate danger, call 911.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;border-top:1px solid #F0F0F0;">
                <p style="margin:20px 0 0;color:#9E9EAE;font-size:12px;line-height:18px;">
                  You're receiving this because a report was filed on Axis from ${e(row.reporter_email)}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
