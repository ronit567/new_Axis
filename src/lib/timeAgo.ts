// Pure, dependency-free relative-time formatter.
// Output style deliberately mirrors the mock data in src/data/mockListings.ts
// ("just now", "3d ago", "1w ago", "2mo ago") so migrating a screen from mock
// to live data does not change the visible label format.
//
// `now` is injectable so callers (and tests) get deterministic output that never
// depends on the wall clock.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
// Calendar months vary in length; 30 days is the conventional approximation for a
// coarse relative label and keeps this function pure (no per-month date math).
const MONTH = 30 * DAY;

// Chat-bubble timestamps: local 12-hour clock time ("2:14 PM"). Hand-rolled
// because Hermes' Intl support varies by platform/config; this stays
// deterministic everywhere. Falls back to '' on unparseable input.
export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours24 = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  // Unparseable input degrades to "just now" rather than emitting "NaNd ago".
  if (Number.isNaN(then)) return 'just now';

  // Clamp future timestamps (clock skew between device and DB) to the present.
  const diff = Math.max(0, now.getTime() - then);

  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < MONTH) return `${Math.floor(diff / WEEK)}w ago`;
  return `${Math.floor(diff / MONTH)}mo ago`;
}
