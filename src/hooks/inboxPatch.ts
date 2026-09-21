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
//   * the inbox is not loaded yet,
//   * it is the first message with this person (no row to update, and the
//     partner's profile is not in hand), or
//   * the message is about a different listing than the row shows — the row's
//     title, price and Buying/Selling label come from the listing, which the
//     message does not carry.
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
  const index = inbox.findIndex((conversation) => conversation.partnerId === partnerId)
  if (index === -1) return null
  const current = inbox[index]
  if (current.listingId !== message.listingId) return null

  const updated: Conversation = {
    ...current,
    lastMessage: message.body,
    lastMessageAt: timeAgo(message.createdAt),
    unreadCount: current.unreadCount + (countsAsUnread ? 1 : 0),
  }
  // The view orders by newest message, so the touched thread moves to the top.
  return [updated, ...inbox.slice(0, index), ...inbox.slice(index + 1)]
}

// The inbox with one thread's unread count cleared. Returns the same array when
// there is nothing to clear, so callers can skip the cache write.
export function clearUnreadInInbox(
  inbox: Conversation[] | undefined,
  partnerId: string,
): Conversation[] | undefined {
  if (!inbox) return inbox
  const index = inbox.findIndex((conversation) => conversation.partnerId === partnerId)
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
