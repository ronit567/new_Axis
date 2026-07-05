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

// Live incoming messages (AX-501). Mount once inside the signed-in shell
// (MainScreen): pushes each arriving row into its thread cache if that thread
// has been loaded, and refreshes the inbox either way. Threads not yet cached
// simply fetch fresh on open.
export function useMessagesRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    return MessageRepository.subscribeToIncoming(userId, (message) => {
      const key = queryKeys.messages(message.listingId, message.senderId)
      queryClient.setQueryData<Message[]>(key, (old) => {
        if (!old) return old
        // The settled invalidation can race the subscription — dedup by id.
        if (old.some((existing) => existing.id === message.id)) return old
        return [...old, message]
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) })
    })
  }, [userId, queryClient])
}
