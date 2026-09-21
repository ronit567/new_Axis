// The inbox is patched locally instead of rebuilt (see inboxPatch). These pin
// the two things that matter: the patch is only applied when it is exact, and a
// burst of events costs one rebuild.

import { QueryClient } from '@tanstack/react-query';
import {
  applyMessageToInbox,
  cancelInboxRefresh,
  clearUnreadInInbox,
  scheduleInboxRefresh,
} from '../inboxPatch';
import type { Conversation, Message } from '../../types';

const ME = 'me';

function conversation(partnerId: string, over: Partial<Conversation> = {}): Conversation {
  return {
    partnerId,
    partner: { id: partnerId, name: partnerId, initials: 'P', avatarColor: '#000', avatarUrl: null },
    listingId: 'listing-1',
    listingTitle: 'Calculus textbook',
    listingPrice: 45,
    lastMessage: 'old',
    lastMessageAt: '2d ago',
    unreadCount: 0,
    type: 'Buying',
    ...over,
  };
}

function message(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    listingId: 'listing-1',
    senderId: 'avery',
    receiverId: ME,
    body: 'Is this still available?',
    createdAt: new Date().toISOString(),
    readAt: null,
    ...over,
  };
}

describe('applyMessageToInbox', () => {
  it('updates the thread, counts the unread and moves it to the top', () => {
    const inbox = [conversation('blake'), conversation('avery', { unreadCount: 2 })];

    const next = applyMessageToInbox(inbox, message(), ME, true);

    expect(next?.map((c) => c.partnerId)).toEqual(['avery', 'blake']);
    expect(next?.[0]).toMatchObject({
      lastMessage: 'Is this still available?',
      lastMessageAt: 'just now',
      unreadCount: 3,
      listingTitle: 'Calculus textbook',
    });
    // The input is a cache value: it must not be mutated.
    expect(inbox[1].unreadCount).toBe(2);
  });

  it('keys an own send by its receiver and never counts it as unread', () => {
    const inbox = [conversation('avery', { unreadCount: 1 })];
    const sent = message({ senderId: ME, receiverId: 'avery', body: 'Yes it is' });

    const next = applyMessageToInbox(inbox, sent, ME, false);

    expect(next?.[0]).toMatchObject({ lastMessage: 'Yes it is', unreadCount: 1 });
  });

  it('is idempotent for an own send that is applied on success and again on its echo', () => {
    const sent = message({ senderId: ME, receiverId: 'avery' });
    const once = applyMessageToInbox([conversation('avery')], sent, ME, false);
    const twice = applyMessageToInbox(once ?? undefined, sent, ME, false);

    expect(twice).toEqual(once);
  });

  it('declines when the inbox is not loaded', () => {
    expect(applyMessageToInbox(undefined, message(), ME, true)).toBeNull();
  });

  it('declines a first message from someone new: there is no row, and no profile in hand', () => {
    expect(applyMessageToInbox([conversation('blake')], message(), ME, true)).toBeNull();
  });

  it('declines when the message is about a different listing than the row shows', () => {
    const inbox = [conversation('avery')];

    expect(applyMessageToInbox(inbox, message({ listingId: 'listing-2' }), ME, true)).toBeNull();
    expect(applyMessageToInbox(inbox, message({ listingId: null }), ME, true)).toBeNull();
  });
});

describe('clearUnreadInInbox', () => {
  it('zeroes one thread and leaves the rest alone', () => {
    const inbox = [conversation('avery', { unreadCount: 4 }), conversation('blake', { unreadCount: 1 })];

    const next = clearUnreadInInbox(inbox, 'avery');

    expect(next?.map((c) => c.unreadCount)).toEqual([0, 1]);
    expect(inbox[0].unreadCount).toBe(4);
  });

  it('returns the same array when there is nothing to clear', () => {
    const inbox = [conversation('avery')];

    expect(clearUnreadInInbox(inbox, 'avery')).toBe(inbox);
    expect(clearUnreadInInbox(inbox, 'nobody')).toBe(inbox);
    expect(clearUnreadInInbox(undefined, 'avery')).toBeUndefined();
  });
});

describe('scheduleInboxRefresh', () => {
  let client: QueryClient;
  let invalidate: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  });

  afterEach(() => {
    cancelInboxRefresh();
    client.clear();
    jest.useRealTimers();
  });

  it('turns a burst of events into one rebuild', () => {
    // Opening a thread with 30 unread echoes back as 30 UPDATE events.
    for (let i = 0; i < 30; i += 1) {
      scheduleInboxRefresh(client, ME);
      jest.advanceTimersByTime(20);
    }
    expect(invalidate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations', ME] });
  });

  it('still refreshes during a stream that never pauses', () => {
    // An event every 500ms would hold a plain debounce open forever.
    for (let elapsed = 0; elapsed < 3000; elapsed += 500) {
      scheduleInboxRefresh(client, ME);
      jest.advanceTimersByTime(500);
    }

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled, so a pending refresh does not fire after sign-out', () => {
    scheduleInboxRefresh(client, ME);
    cancelInboxRefresh();
    jest.advanceTimersByTime(5000);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
