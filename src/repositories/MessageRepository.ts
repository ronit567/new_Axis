import { supabase } from '../lib/supabase'
import { Contact } from '../types'

export type Message = {
  id: string
  listingId: string
  senderId: string
  receiverId: string
  body: string
  createdAt: string
}

export type SendMessageInput = {
  listingId: string
  receiverId: string
  body: string
}

// Placeholder methods — real Supabase queries + Realtime land in Phase 2.
export const MessageRepository = {
  async getConversations(userId: string): Promise<Contact[]> {
    return []
  },
  async getMessages(listingId: string): Promise<Message[]> {
    return []
  },
  async send(senderId: string, data: SendMessageInput): Promise<Message> {
    throw new Error('MessageRepository.send not implemented')
  },
}
