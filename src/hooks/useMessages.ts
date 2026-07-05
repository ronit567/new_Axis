import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageRepository,
  SendMessageInput,
} from '../repositories/MessageRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'
import type { Conversation, Message } from '../types'

export function useConversations() {
  const { user } = useAuth()
  return useQuery<Conversation[]>({
    queryKey: queryKeys.conversations(user?.id ?? ''),
    queryFn: () => {
      if (!user) return []
      return MessageRepository.getConversations(user.id)
    },
    enabled: !!user,
  })
}

export function useMessages(listingId: string | null, partnerId: string) {
  const { user } = useAuth()
  return useQuery<Message[]>({
    queryKey: queryKeys.messages(listingId, partnerId),
    queryFn: () => {
      if (!user) return []
      return MessageRepository.getMessages(listingId, partnerId, user.id)
    },
    enabled: !!user && !!partnerId,
  })
}

// Optimistic send: the bubble appears instantly under a temp id, rolls back on
// error, and is reconciled with the server row by the settled invalidation.
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
      const key = queryKeys.messages(input.listingId, input.receiverId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Message[]>(key)
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
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
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages(input.listingId, input.receiverId),
      })
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations(user.id),
        })
      }
    },
  })
}

export function useMarkConversationRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { listingId: string | null; partnerId: string }) => {
      if (!user) throw new Error('Not signed in')
      return MessageRepository.markConversationRead(input.listingId, input.partnerId, user.id)
    },
    // Refresh the inbox so the unread dot clears; the open thread's own cache
    // doesn't render read state yet, so it can stay as-is.
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations(user.id),
        })
      }
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
      queryKeys.messages(
        message.listingId,
        message.senderId === userId ? message.receiverId : message.senderId,
      )
    return MessageRepository.subscribeToMessages(userId, {
      onInsert: (message) => {
        queryClient.setQueryData<Message[]>(threadKey(message), (old) => {
          if (!old) return old
          // The settled invalidation can race the subscription — dedup by id.
          if (old.some((existing) => existing.id === message.id)) return old
          // Our own send echoing back before the mutation settles: replace the
          // optimistic bubble instead of appending a duplicate.
          const optimisticIndex = old.findIndex(
            (existing) =>
              existing.id.startsWith('optimistic-') &&
              existing.senderId === message.senderId &&
              existing.body === message.body,
          )
          if (optimisticIndex !== -1) {
            const next = [...old]
            next[optimisticIndex] = message
            return next
          }
          return [...old, message]
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) })
      },
      onUpdate: (message) => {
        queryClient.setQueryData<Message[]>(threadKey(message), (old) =>
          old?.map((existing) => (existing.id === message.id ? message : existing)),
        )
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) })
      },
    })
  }, [userId, queryClient])
}
