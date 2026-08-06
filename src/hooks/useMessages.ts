import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  MessageRepository,
  SendMessageInput,
} from '../repositories/MessageRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import {
  applyMessageToInbox,
  cancelInboxRefresh,
  clearUnreadInInbox,
  scheduleInboxRefresh,
} from './inboxPatch'
import { scheduleCatchUp } from './useCatchUp'
import type { Conversation, Message } from '../types'

// A message landing in a loaded thread: replace the entry that shares its id
// (ids are client-generated, so an own send coming back from the server matches
// its optimistic entry and swaps in the canonical created_at), else append.
function upsertMessage(thread: Message[], message: Message): Message[] {
  const index = thread.findIndex((existing) => existing.id === message.id)
  if (index === -1) return [...thread, message]
  const next = [...thread]
  next[index] = message
  return next
}

// Apply a message to the cached inbox without asking the server, falling back
// to one coalesced rebuild when that is not possible (see inboxPatch).
function applyToInbox(
  queryClient: QueryClient,
  userId: string,
  message: Message,
  countsAsUnread: boolean,
) {
  const key = queryKeys.conversations(userId)
  const patched = applyMessageToInbox(
    queryClient.getQueryData<Conversation[]>(key),
    message,
    userId,
    countsAsUnread,
  )
  if (!patched) {
    scheduleInboxRefresh(queryClient, userId)
    return
  }
  // A rebuild already in flight was issued before this message existed, and
  // would land on top of the patch with an older inbox. Queue another behind it.
  if (queryClient.isFetching({ queryKey: key, exact: true }) > 0) {
    scheduleInboxRefresh(queryClient, userId)
  }
  queryClient.setQueryData<Conversation[]>(key, patched)
  // Stale but not refetched: MainScreen keeps this query mounted all session,
  // so a plain invalidate is an immediate rebuild. Marked stale, it reconciles
  // with the server the next time the Messages tab mounts.
  queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
}

export function useConversations() {
  const { user } = useAuth()
  return useQuery<Conversation[]>({
    queryKey: queryKeys.conversations(user?.id ?? ''),
    // The signal matters here more than anywhere: a superseded rebuild that is
    // not aborted still runs all three queries to completion on the server.
    queryFn: ({ signal }) => {
      if (!user) return []
      return MessageRepository.getConversations(user.id, signal)
    },
    enabled: !!user,
  })
}

export function useMessages(partnerId: string) {
  const { user } = useAuth()
  return useQuery<Message[]>({
    queryKey: queryKeys.messages(partnerId),
    queryFn: () => {
      if (!user) return []
      return MessageRepository.getMessages(partnerId, user.id)
    },
    enabled: !!user && !!partnerId,
  })
}

// Optimistic send: the bubble appears instantly under the message's real
// (client-generated) id, rolls back on error, and is reconciled with the
// server row — by the realtime echo and the settled invalidation — via that
// same id.
export function useSendMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SendMessageInput) => {
      if (!user) throw new Error('Not signed in')
      return MessageRepository.send(user.id, input)
    },
    onMutate: async (input) => {
      if (!user) return undefined
      const key = queryKeys.messages(input.receiverId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Message[]>(key)
      const optimistic: Message = {
        id: input.id,
        listingId: input.listingId,
        senderId: user.id,
        receiverId: input.receiverId,
        body: input.body,
        createdAt: new Date().toISOString(),
        readAt: null,
      }
      queryClient.setQueryData<Message[]>(key, (old) => [...(old ?? []), optimistic])
      return { key, previous }
    },
    // A failed send is the one case where the local picture may be wrong in a
    // way that cannot be computed (a block, a rate limit, the content filter),
    // so this is where the server gets asked.
    onError: (_error, input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(input.receiverId) })
      if (user) scheduleInboxRefresh(queryClient, user.id)
    },
    // The insert returns the row it wrote, so the optimistic entry is swapped
    // for it and the inbox row is patched — no requests. This used to refetch
    // the whole thread (up to 200 rows) and rebuild the inbox after every send,
    // and the realtime echo of the same insert then rebuilt the inbox again.
    onSuccess: (sent, input) => {
      queryClient.setQueryData<Message[]>(queryKeys.messages(input.receiverId), (old) =>
        old ? upsertMessage(old, sent) : old,
      )
      if (user) applyToInbox(queryClient, user.id, sent, false)
    },
  })
}

export function useMarkConversationRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { partnerId: string }) => {
      if (!user) throw new Error('Not signed in')
      return MessageRepository.markConversationRead(input.partnerId, user.id)
    },
    // Cleared before the request, not after: the UPDATE flips every unread row,
    // each one echoes back over realtime, and those echoes can beat the HTTP
    // response. With the count already at zero the echo handler has nothing to
    // do; cleared afterwards, every echo looked like news and asked for a
    // rebuild — one per unread message in the thread.
    onMutate: (input) => {
      if (!user) return
      const key = queryKeys.conversations(user.id)
      queryClient.setQueryData<Conversation[]>(key, (old) =>
        clearUnreadInInbox(old, input.partnerId),
      )
      if (queryClient.isFetching({ queryKey: key, exact: true }) > 0) {
        scheduleInboxRefresh(queryClient, user.id)
      }
    },
    onSuccess: (_data, input) => {
      if (!user) return
      // No refetch: stamp the received messages in the cached thread directly.
      const readAt = new Date().toISOString()
      queryClient.setQueryData<Message[]>(
        queryKeys.messages(input.partnerId),
        (old) =>
          old?.map((m) =>
            m.receiverId === user.id && m.readAt === null ? { ...m, readAt } : m,
          ),
      )
    },
    // The badge was cleared on a promise the server did not keep.
    onError: () => {
      if (user) scheduleInboxRefresh(queryClient, user.id)
    },
  })
}

// Live message stream (AX-501). Mount once inside the signed-in shell
// (MainScreen). INSERTs in both directions (RLS scopes the channel to this
// user's rows) land in their thread cache if that thread has been loaded, and
// refresh the inbox either way — threads not yet cached simply fetch fresh on
// open. UPDATEs carry read_at flips, so an open thread reflects read receipts
// and the inbox unread count follows reads made on another device.
export function useMessagesRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    // Own sends key the thread by receiver; incoming ones by sender.
    const threadKey = (message: Message) =>
      queryKeys.messages(message.senderId === userId ? message.receiverId : message.senderId)
    const unsubscribe = MessageRepository.subscribeToMessages(userId, {
      onInsert: (message) => {
        const key = threadKey(message)
        // Checked before the write below: an event for a message this thread
        // already holds is a repeat, and must not count as unread twice.
        const alreadyKnown =
          queryClient.getQueryData<Message[]>(key)?.some((m) => m.id === message.id) ?? false
        queryClient.setQueryData<Message[]>(key, (old) =>
          old ? upsertMessage(old, message) : old,
        )
        applyToInbox(
          queryClient,
          userId,
          message,
          message.receiverId === userId && message.readAt === null && !alreadyKnown,
        )
      },
      onUpdate: (message) => {
        queryClient.setQueryData<Message[]>(threadKey(message), (old) =>
          old?.map((existing) => (existing.id === message.id ? message : existing)),
        )
        // The partner reading my messages only changes the "Read" label, done
        // above. A read of a message *I received* can change my unread count —
        // but when this device made that read, useMarkConversationRead already
        // zeroed the count, and these are just its echoes (one per message).
        // Only a read from somewhere else is news.
        if (message.receiverId !== userId) return
        const inbox = queryClient.getQueryData<Conversation[]>(queryKeys.conversations(userId))
        const thread = inbox?.find((c) => c.partnerId === message.senderId)
        if (thread && thread.unreadCount === 0) return
        scheduleInboxRefresh(queryClient, userId)
      },
      onResubscribed: () => scheduleCatchUp(queryClient, userId),
    })
    return () => {
      unsubscribe()
      cancelInboxRefresh()
    }
  }, [userId, queryClient])
}
