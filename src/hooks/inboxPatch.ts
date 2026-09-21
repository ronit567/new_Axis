import type { QueryClient } from '@tanstack/react-query'
import type { Conversation, Message } from '../types'
import { timeAgo } from '../lib/timeAgo'
import { queryKeys } from './queryKeys'
import { cancelScheduledInvalidate, scheduleInvalidate } from './coalescedInvalidate'

// Rebuilding the inbox is the most expensive read in the app: the
// conversation_list view walks every message the user has ever exchanged, then
// two more queries hydrate partners and listings. It used to be invalidated on
// every send, every received message, every read receipt and every echoed
// UPDATE — several rebuilds per message, per participant.
//
// Most of those events change one row of the inbox in a way the client can
// compute itself. These helpers do that, and say so when they cannot.

// The inbox with `message` applied, or null when that cannot be done locally
// and the caller has to fall back to a refetch:
//   * the inbox is not loaded yet, or
//   * there is no row for this (listing, partner) thread — a first message
//     with this person, or a first message with a known person about a listing
//     they haven't been messaged about before. Either way there is nothing to
//     update, and neither the partner's profile nor the listing's title,
//     price and thumbnail are in hand to build a row from.
//
// The thread is the (listing, person) pair since 0051, so the lookup matches
// on both. It used to match on the partner alone and then bail when the
// listing disagreed; now a disagreeing listing is simply a different thread,
// and "no row for it" is the ordinary miss above.
//
// `countsAsUnread` is the caller's call, not inferred here: only the caller
// knows whether this event is a duplicate of one it has already applied.
export function applyMessageToInbox(
  inbox: Conversation[] | undefined,
  message: Message,
  userId: string,
  countsAsUnread: boolean,
): Conversation[] | null {
  if (!inbox) return null
  const partnerId = message.senderId === userId ? message.receiverId : message.senderId
  const index = inbox.findIndex(
    (conversation) =>
      conversation.partnerId === partnerId && conversation.listingId === message.listingId,
  )
  if (index === -1) return null
  const current = inbox[index]

  const updated: Conversation = {
    ...current,
    lastMessage: message.body,
    lastMessageAt: timeAgo(message.createdAt),
    unreadCount: current.unreadCount + (countsAsUnread ? 1 : 0),
  }
  // The view orders by newest message, so the touched thread moves to the top.
  return [updated, ...inbox.slice(0, index), ...inbox.slice(index + 1)]
}

// The inbox with one thread's unread count cleared. The thread is the
// (listing, partner) pair (0051), so opening the chat about one listing leaves
// the badge on the other chats with the same person alone — matching what
// MessageRepository.markConversationRead actually stamps on the server.
// Returns the same array when there is nothing to clear, so callers can skip
// the cache write.
export function clearUnreadInInbox(
  inbox: Conversation[] | undefined,
  partnerId: string,
  listingId: string | null,
): Conversation[] | undefined {
  if (!inbox) return inbox
  const index = inbox.findIndex(
    (conversation) =>
      conversation.partnerId === partnerId && conversation.listingId === listingId,
  )
  if (index === -1 || inbox[index].unreadCount === 0) return inbox
  const next = [...inbox]
  next[index] = { ...next[index], unreadCount: 0 }
  return next
}

// --- Coalesced refetch -------------------------------------------------------
//
// For the events that do need the server (a new partner, a listing change, a
// read made on another device), a burst must cost one rebuild, not one each.

const INBOX_BURST = 'inbox'

export function scheduleInboxRefresh(queryClient: QueryClient, userId: string): void {
  scheduleInvalidate(queryClient, INBOX_BURST, [queryKeys.conversations(userId)])
}

export function cancelInboxRefresh(): void {
  cancelScheduledInvalidate(INBOX_BURST)
}
