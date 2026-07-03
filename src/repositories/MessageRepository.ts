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
  // partnerId scopes to the single 1:1 thread about this listing. Without it a
  // seller with several interested buyers would get every buyer's messages
  // (all of which pass the sender/receiver RLS check) merged into one array.
  async getMessages(listingId: string, partnerId: string): Promise<Message[]> {
    return []
  },
  async send(senderId: string, data: SendMessageInput): Promise<Message> {
    throw new Error('MessageRepository.send not implemented')
  },
}
