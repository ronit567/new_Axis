import { formatClockTime, timeAgo } from '../timeAgo';

// Fixed reference point so every case is deterministic.
const NOW = new Date('2026-07-02T12:00:00.000Z');

// Build an ISO string `ms` before NOW.
function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

describe('timeAgo', () => {
  it('renders sub-minute as "just now"', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now');
    expect(timeAgo(ago(59 * SECOND), NOW)).toBe('just now');
  });

  it('renders minutes', () => {
    expect(timeAgo(ago(MINUTE), NOW)).toBe('1m ago');
    expect(timeAgo(ago(59 * MINUTE), NOW)).toBe('59m ago');
  });

  it('renders hours', () => {
    expect(timeAgo(ago(HOUR), NOW)).toBe('1h ago');
    expect(timeAgo(ago(23 * HOUR), NOW)).toBe('23h ago');
  });

  it('renders days', () => {
    expect(timeAgo(ago(DAY), NOW)).toBe('1d ago');
    expect(timeAgo(ago(3 * DAY), NOW)).toBe('3d ago');
    expect(timeAgo(ago(6 * DAY), NOW)).toBe('6d ago');
  });

  it('renders weeks', () => {
    expect(timeAgo(ago(WEEK), NOW)).toBe('1w ago');
    // 29 days is still within a month => 4 weeks.
    expect(timeAgo(ago(29 * DAY), NOW)).toBe('4w ago');
  });

  it('renders months', () => {
    expect(timeAgo(ago(MONTH), NOW)).toBe('1mo ago');
    expect(timeAgo(ago(2 * MONTH), NOW)).toBe('2mo ago');
  });

  it('crosses each boundary exactly', () => {
    expect(timeAgo(ago(MINUTE - 1), NOW)).toBe('just now');
    expect(timeAgo(ago(HOUR - 1), NOW)).toBe('59m ago');
    expect(timeAgo(ago(DAY - 1), NOW)).toBe('23h ago');
    expect(timeAgo(ago(WEEK - 1), NOW)).toBe('6d ago');
    expect(timeAgo(ago(MONTH - 1), NOW)).toBe('4w ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(timeAgo(new Date(NOW.getTime() + HOUR).toISOString(), NOW)).toBe('just now');
  });

  it('degrades gracefully on unparseable input', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('just now');
  });
});

describe('formatClockTime', () => {
  // Built from local-time constructors (not UTC ISO literals) so the assertions
  // are timezone-safe regardless of where the test runs.
  it('formats an afternoon time as 12-hour clock with AM/PM', () => {
    expect(formatClockTime(new Date(2026, 0, 5, 14, 14).toISOString())).toBe('2:14 PM');
  });

  it('formats midnight as 12:xx AM', () => {
    expect(formatClockTime(new Date(2026, 0, 5, 0, 5).toISOString())).toBe('12:05 AM');
  });

  it('formats noon as 12:xx PM', () => {
    expect(formatClockTime(new Date(2026, 0, 5, 12, 0).toISOString())).toBe('12:00 PM');
  });

  it('pads single-digit minutes', () => {
    expect(formatClockTime(new Date(2026, 0, 5, 9, 4).toISOString())).toBe('9:04 AM');
  });

  it('degrades to an empty string on unparseable input', () => {
    expect(formatClockTime('not-a-date')).toBe('');
  });
});
