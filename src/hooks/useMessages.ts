import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageRepository,
  SendMessageInput,
} from '../repositories/MessageRepository'
import { useAuth } from '../context/AuthContext'
import { queryKeys } from './queryKeys'

export function useConversations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.conversations(user?.id ?? ''),
    queryFn: () => {
      if (!user) return []
      return MessageRepository.getConversations(user.id)
    },
    enabled: !!user,
  })
}

export function useMessages(listingId: string, partnerId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.messages(listingId, partnerId),
    queryFn: () => MessageRepository.getMessages(listingId, partnerId),
    enabled: !!user && !!listingId && !!partnerId,
  })
}

export function useSendMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SendMessageInput) => {
      if (!user) throw new Error('Not signed in')
      return MessageRepository.send(user.id, input)
    },
    onSuccess: (_data, input) => {
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
