import type { QueryClient, QueryKey } from '@tanstack/react-query'

// Realtime delivers one event per changed row, and the natural handler —
// invalidate on each — turns one user action into a volley of identical
// refetches: marking 25 notifications read is a single UPDATE that echoes back
// as 25 events. This collapses a burst into one invalidation.
//
// Trailing debounce with a ceiling, so a stream that never pauses still
// refreshes every few seconds rather than never.
const DEBOUNCE_MS = 600
const MAX_WAIT_MS = 3000

type Pending = { timer: ReturnType<typeof setTimeout>; startedAt: number }
const pending = new Map<string, Pending>()

// `name` identifies the burst: calls sharing a name share one timer.
//
// `jitterMs` adds a random delay on top, for invalidations that many clients
// would otherwise make in the same instant (everyone re-joining after a
// Realtime restart, a lecture hall of phones waking up together).
export function scheduleInvalidate(
  queryClient: QueryClient,
  name: string,
  queryKeys: QueryKey[],
  jitterMs = 0,
): void {
  const now = Date.now()
  const existing = pending.get(name)
  if (existing) clearTimeout(existing.timer)
  const startedAt = existing?.startedAt ?? now
  const wait =
    Math.max(0, Math.min(DEBOUNCE_MS, startedAt + MAX_WAIT_MS - now)) + Math.random() * jitterMs
  const timer = setTimeout(() => {
    pending.delete(name)
    for (const queryKey of queryKeys) queryClient.invalidateQueries({ queryKey })
  }, wait)
  pending.set(name, { timer, startedAt })
}

// Drop a pending invalidation — on sign-out, so it cannot fire for the next
// user of the device.
export function cancelScheduledInvalidate(name: string): void {
  const existing = pending.get(name)
  if (!existing) return
  clearTimeout(existing.timer)
  pending.delete(name)
}
