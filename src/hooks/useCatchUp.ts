import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import { scheduleInvalidate } from './coalescedInvalidate'

// Realtime is the only thing keeping the inbox, an open thread, the tab badge
// and the bell current: focus refetching is off, and those queries stay mounted
// for the whole session, so nothing else ever refetches them. That holds only
// while the socket stays up, and on a phone it does not (see realtimeStatus).
//
// After a gap, ask the server once for everything realtime feeds. Deliberately
// not a global focus refetch: that would re-run every stale query, including
// every loaded page of the feed, in a burst synchronised across the campus the
// moment a lecture ends. This is four light reads.
const SPREAD_MS = 2000

export function scheduleCatchUp(queryClient: QueryClient, userId: string): void {
  scheduleInvalidate(
    queryClient,
    `catchup:${userId}`,
    [
      queryKeys.conversations(userId),
      // Every cached thread: the open one refetches, the rest go stale.
      ['messages'],
      queryKeys.notifications(userId),
      queryKeys.unreadNotificationCount(userId),
    ],
    SPREAD_MS,
  )
}

// Long enough that the socket has plausibly dropped. Shorter trips away (a
// permission sheet, a glance at a notification) keep their connection.
const MIN_BACKGROUND_MS = 15_000

// Mount once in the signed-in shell. A channel re-join usually reports the same
// gap a moment later; both land in one coalesced invalidation.
export function useForegroundCatchUp(): void {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id
  const backgroundedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) return undefined
    const subscription = AppState.addEventListener('change', (state) => {
      // 'inactive' is Control Center, the image picker, a system alert: the
      // app is still running and the socket is still up.
      if (state === 'background') {
        backgroundedAt.current = Date.now()
        return
      }
      if (state !== 'active' || backgroundedAt.current === null) return
      const away = Date.now() - backgroundedAt.current
      backgroundedAt.current = null
      if (away >= MIN_BACKGROUND_MS) scheduleCatchUp(queryClient, userId)
    })
    return () => subscription.remove()
  }, [userId, queryClient])
}
