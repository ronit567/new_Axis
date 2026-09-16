// Tests for report-alert's email content. Run with:
//   npx deno test --no-lock --node-modules-dir=none supabase/functions/report-alert/
//
// Filename ends in _test.ts, not .test.ts, so Jest's testMatch never picks up
// Deno code; tsconfig already excludes supabase/functions.

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  buildAlertEmail,
  buildConfirmationEmail,
  reportReference,
  type QueueRow,
} from './email.ts';

const row: QueueRow = {
  id: '3f2a9c1d-5b6e-4a7f-8c9d-0e1f2a3b4c5d',
  created_at: '2026-09-15T18:30:00Z',
  status: 'open',
  reason: 'prohibited_item',
  target_type: 'listing',
  reporter_name: 'Ronit Sharma',
  reporter_email: 'rsharma42@uwo.ca',
  target_user_name: 'Jamie Lee',
  target_user_email: 'jlee@uwo.ca',
  target_listing_title: 'Desk lamp',
  target_listing_id: '11111111-1111-4111-8111-111111111111',
  target_user_id: '22222222-2222-4222-8222-222222222222',
};

// Visible text only: tags and inline styles carry numbers like line-height:24px.
function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

Deno.test('neither email promises a response time', () => {
  const alert = buildAlertEmail(row);
  const confirmation = buildConfirmationEmail(row)!;
  for (const body of [alert.text, confirmation.text, visibleText(confirmation.html!)]) {
    assert(!/\b24\b|\bhours?\b|\bwithin\b|\bdays?\b/i.test(body), `found a timeframe in: ${body}`);
  }
});

Deno.test('confirmation names what was reported, the reason, and a reference', () => {
  const email = buildConfirmationEmail(row)!;
  assertEquals(email.subject, 'We received your report');
  assertStringIncludes(email.text, 'Hi Ronit,');
  assertStringIncludes(email.text, 'the listing “Desk lamp”');
  assertStringIncludes(email.text, 'Reason:    Prohibited item');
  assertStringIncludes(email.text, 'Reference: 3F2A9C1D');
  // 18:30 UTC is 2:30 p.m. in Toronto during daylight time.
  assertStringIncludes(email.text, 'Sep 15, 2026');
});

Deno.test('confirmation phrases user and chat reports by the person', () => {
  assertStringIncludes(
    buildConfirmationEmail({ ...row, target_type: 'user' })!.text,
    "Jamie Lee's profile",
  );
  assertStringIncludes(
    buildConfirmationEmail({ ...row, target_type: 'chat' })!.text,
    'your conversation with Jamie Lee',
  );
});

Deno.test('confirmation falls back when names are missing', () => {
  const email = buildConfirmationEmail({
    ...row,
    target_type: 'user',
    reporter_name: null,
    target_user_name: null,
  })!;
  assertStringIncludes(email.text, 'Hi there,');
  assertStringIncludes(email.text, 'reporting a profile on Axis');
});

Deno.test('confirmation never tells the reporter anything about the other party', () => {
  const email = buildConfirmationEmail(row)!;
  for (const body of [email.text, email.html!]) {
    assert(!body.includes('jlee@uwo.ca'), 'target email leaked');
    assert(!body.includes(row.target_user_id!), 'target user id leaked');
  }
});

Deno.test('confirmation HTML escapes user-written text', () => {
  const email = buildConfirmationEmail({
    ...row,
    target_listing_title: '<img src=x onerror=alert(1)> & "lamp"',
  })!;
  assert(!email.html!.includes('<img src=x'), 'listing title was not escaped');
  assertStringIncludes(email.html!, '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;lamp&quot;');
});

Deno.test('no confirmation without a reporter email', () => {
  assertEquals(buildConfirmationEmail({ ...row, reporter_email: null }), null);
});

Deno.test('reference is the first eight hex digits, uppercased', () => {
  assertEquals(reportReference(row.id), '3F2A9C1D');
});
