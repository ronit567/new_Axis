import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotificationRepository } from '../repositories/NotificationRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import { Notification } from '../types'

export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.notifications(user?.id ?? ''),
    queryFn: () => {
      if (!user) return []
      return NotificationRepository.list(user.id)
    },
    enabled: !!user,
  })
}

export function useUnreadNotificationCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.unreadNotificationCount(user?.id ?? ''),
    queryFn: () => {
      if (!user) return 0
      return NotificationRepository.unreadCount(user.id)
    },
    enabled: !!user,
    // refetchOnWindowFocus is globally off (QueryProvider) — the bell stays
    // fresh via mutation invalidation plus a remount on tab focus, so a short
    // staleTime here just avoids refetching on every remount in between.
    staleTime: 30_000,
  })
}

// Optimistic like useToggleSaved: flip the tapped row to read and decrement
// the bell count immediately, restoring both caches on failure.
export function useMarkNotificationRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => NotificationRepository.markRead(id),
    onMutate: async (id) => {
      if (!user) return undefined
      const listKey = queryKeys.notifications(user.id)
      const countKey = queryKeys.unreadNotificationCount(user.id)

      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ])

      const previousList = queryClient.getQueryData<Notification[]>(listKey)
      const previousCount = queryClient.getQueryData<number>(countKey)
      const wasUnread = previousList?.find((n) => n.id === id)?.read === false

      queryClient.setQueryData<Notification[]>(listKey, (old = []) =>
        old.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      if (wasUnread) {
        queryClient.setQueryData<number>(countKey, (old) => Math.max(0, (old ?? 0) - 1))
      }

      return { listKey, countKey, previousList, previousCount }
    },
    onError: (_err, _id, context) => {
      if (!context) return
      queryClient.setQueryData(context.listKey, context.previousList)
      queryClient.setQueryData(context.countKey, context.previousCount)
    },
    onSettled: (_data, _err, _id, context) => {
      if (!context) return
      queryClient.invalidateQueries({ queryKey: context.listKey })
      queryClient.invalidateQueries({ queryKey: context.countKey })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Not signed in')
      return NotificationRepository.markAllRead(user.id)
    },
    onMutate: async () => {
      if (!user) return undefined
      const listKey = queryKeys.notifications(user.id)
      const countKey = queryKeys.unreadNotificationCount(user.id)

      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ])

      const previousList = queryClient.getQueryData<Notification[]>(listKey)
      const previousCount = queryClient.getQueryData<number>(countKey)

      queryClient.setQueryData<Notification[]>(listKey, (old = []) =>
        old.map((n) => ({ ...n, read: true })),
      )
      queryClient.setQueryData<number>(countKey, 0)

      return { listKey, countKey, previousList, previousCount }
    },
    onError: (_err, _vars, context) => {
      if (!context) return
      queryClient.setQueryData(context.listKey, context.previousList)
      queryClient.setQueryData(context.countKey, context.previousCount)
    },
    onSettled: (_data, _err, _vars, context) => {
      if (!context) return
      queryClient.invalidateQueries({ queryKey: context.listKey })
      queryClient.invalidateQueries({ queryKey: context.countKey })
    },
  })
}
