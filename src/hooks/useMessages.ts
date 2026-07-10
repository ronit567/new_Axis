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

// Whether the current user has ever messaged this seller, in either
// direction — gates the review-writing UI to match the reviews_insert_reviewer
// RLS policy (0020) so the affordance isn't shown only to fail on submit.
export function useHasChattedWith(partnerId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.hasChattedWith(user?.id ?? '', partnerId),
    queryFn: () => MessageRepository.hasChattedWith(user!.id, partnerId),
    // No self-chat gate needed on your own profile; skip the query there.
    enabled: !!user && !!partnerId && partnerId !== user.id,
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
      const key = queryKeys.messages(input.listingId, input.receiverId)
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
    // Stamp the thread cache directly (the realtime UPDATE echo would do it
    // too, but this also converges when the socket is down), then refresh the
    // inbox so the unread dot clears. The timestamp is approximate until the
    // next refetch replaces it with the server's value.
    onSuccess: (_data, input) => {
      if (!user) return
      const readAt = new Date().toISOString()
      queryClient.setQueryData<Message[]>(
        queryKeys.messages(input.listingId, input.partnerId),
        (old) =>
          old?.map((m) =>
            m.receiverId === user.id && m.readAt === null ? { ...m, readAt } : m,
          ),
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(user.id),
      })
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
          // Ids are client-generated, so an own send echoing back shares its
          // optimistic entry's id — replace it (the server row carries the
          // canonical created_at). Also dedups against the settled refetch.
          const index = old.findIndex((existing) => existing.id === message.id)
          if (index !== -1) {
            const next = [...old]
            next[index] = message
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
        // Only reads of messages *I received* change my unread counts (a read
        // on another device clearing the inbox dot). The partner reading my
        // sent messages only affects the "Read" label, already updated above —
        // skip the 3-query inbox rebuild for those.
        if (message.receiverId === userId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) })
        }
      },
    })
  }, [userId, queryClient])
}
