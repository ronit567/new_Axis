// MessageRepository (AX-113): mocks `supabase.from(...)` as a thenable chain,
// same approach as ListingRepository.test.ts, extended with the extra
// chainable methods (or/limit/is/in/update/insert/single) MessageRepository uses.

import type { ConversationListRow, ListingRow, MessageRow, ProfileRow } from '../../types/database';

type QueryResult<T> = { data: T | null; error: unknown };

function makeQueryBuilder<T>(result: QueryResult<T>, singleResult?: QueryResult<any>) {
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    is: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(singleResult ?? result)),
    then: (resolve: (value: QueryResult<T>) => unknown) => resolve(result),
  };
  return builder;
}

const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { MessageRepository } from '../MessageRepository';

function makeMessageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'm1',
    listing_id: 'lst1',
    sender_id: 'p1',
    receiver_id: 'me',
    body: 'Hello',
    created_at: '2026-07-01T10:00:00.000Z',
    read_at: null,
    ...overrides,
  };
}

function makeConversationListRow(overrides: Partial<ConversationListRow> = {}): ConversationListRow {
  return {
    id: 'm1',
    listing_id: 'lst1',
    sender_id: 'p1',
    receiver_id: 'me',
    body: 'Hello',
    created_at: '2026-07-01T10:00:00.000Z',
    read_at: null,
    partner_id: 'p1',
    unread_count: 0,
    ...overrides,
  };
}

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'p1',
    name: 'Priya S.',
    initials: 'PS',
    program: 'BMOS',
    year: 2,
    location: 'Elgin Hall',
    bio: null,
    avatar_url: null,
    avatar_color: '#5C2D91',
    verified: true,
    reply_time: '~1h',
    created_at: '2024-09-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeListingRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: 'lst1',
    seller_id: 'me',
    title: 'Organic Chem 2 textbook',
    description: 'Great condition.',
    price: 45,
    is_free: false,
    is_trade: false,
    condition: 'Good',
    category: 'Textbooks',
    pickup: 'UCC, Room 110',
    image_urls: [],
    thumb_urls: [],
    status: 'active',
    views: 22,
    created_at: '2026-06-29T12:00:00.000Z',
    ...overrides,
  };
}

function mockTables(map: Record<string, any>) {
  mockFrom.mockImplementation((table: string) => {
    if (table in map) return map[table];
    throw new Error(`Unexpected table: ${table}`);
  });
  return map;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockChannel.mockReset();
  mockRemoveChannel.mockReset();
});

describe('MessageRepository.getConversations', () => {
  it('queries the conversation_list view ordered newest-first and maps a row to a Conversation', async () => {
    const row = makeConversationListRow({
      id: 'm1',
      listing_id: 'lst1',
      sender_id: 'p1',
      receiver_id: 'me',
      body: 'Newest',
      partner_id: 'p1',
      unread_count: 2,
    });
    const conversationListBuilder = makeQueryBuilder<ConversationListRow[]>({ data: [row], error: null });
    mockTables({
      conversation_list: conversationListBuilder,
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [makeListingRow({ id: 'lst1', seller_id: 'p1' })],
        error: null,
      }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(mockFrom).toHaveBeenCalledWith('conversation_list');
    expect(conversationListBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toHaveLength(1);
    expect(result[0].lastMessage).toBe('Newest');
    expect(result[0].unreadCount).toBe(2);
  });

  it('treats the same partner across two different listings as two separate conversations', async () => {
    const rows = [
      makeConversationListRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me', partner_id: 'p1' }),
      makeConversationListRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p1', receiver_id: 'me', partner_id: 'p1' }),
    ];
    mockTables({
      conversation_list: makeQueryBuilder<ConversationListRow[]>({ data: rows, error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [makeListingRow({ id: 'lst1' }), makeListingRow({ id: 'lst2' })],
        error: null,
      }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.listingId).sort()).toEqual(['lst1', 'lst2']);
  });

  it('preserves the view row order in the returned conversations', async () => {
    const rows = [
      makeConversationListRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me', partner_id: 'p1' }),
      makeConversationListRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p2', receiver_id: 'me', partner_id: 'p2' }),
      makeConversationListRow({ id: 'm3', listing_id: 'lst3', sender_id: 'p3', receiver_id: 'me', partner_id: 'p3' }),
    ];
    mockTables({
      conversation_list: makeQueryBuilder<ConversationListRow[]>({ data: rows, error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({
        data: [makeProfileRow({ id: 'p1' }), makeProfileRow({ id: 'p2' }), makeProfileRow({ id: 'p3' })],
        error: null,
      }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [makeListingRow({ id: 'lst1' }), makeListingRow({ id: 'lst2' }), makeListingRow({ id: 'lst3' })],
        error: null,
      }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(result.map((c) => c.listingId)).toEqual(['lst1', 'lst2', 'lst3']);
  });

  it('drops a conversation entirely when its partner profile is missing (RLS-hidden = blocked)', async () => {
    const rows = [
      makeConversationListRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me', partner_id: 'p1' }),
      makeConversationListRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p2', receiver_id: 'me', partner_id: 'p2' }),
    ];
    mockTables({
      conversation_list: makeQueryBuilder<ConversationListRow[]>({ data: rows, error: null }),
      // p2 is absent from the profiles response.
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [makeListingRow({ id: 'lst1' }), makeListingRow({ id: 'lst2' })],
        error: null,
      }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(result).toHaveLength(1);
    expect(result[0].partnerId).toBe('p1');
  });

  it('marks a conversation Selling for the user\'s own listing, Buying for someone else\'s, and Buying when the listing is missing', async () => {
    const rows = [
      makeConversationListRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me', partner_id: 'p1' }),
      makeConversationListRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p2', receiver_id: 'me', partner_id: 'p2' }),
      makeConversationListRow({ id: 'm3', listing_id: 'lst3', sender_id: 'p3', receiver_id: 'me', partner_id: 'p3' }),
    ];
    mockTables({
      conversation_list: makeQueryBuilder<ConversationListRow[]>({ data: rows, error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({
        data: [makeProfileRow({ id: 'p1' }), makeProfileRow({ id: 'p2' }), makeProfileRow({ id: 'p3' })],
        error: null,
      }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [
          makeListingRow({ id: 'lst1', seller_id: 'me' }),
          makeListingRow({ id: 'lst2', seller_id: 'p2' }),
          // lst3 is absent (RLS-hidden or deleted) — the thread still renders.
        ],
        error: null,
      }),
    });

    const result = await MessageRepository.getConversations('me');
    const byListing = new Map(result.map((c) => [c.listingId, c]));

    expect(byListing.get('lst1')?.type).toBe('Selling');
    expect(byListing.get('lst2')?.type).toBe('Buying');
    const missing = byListing.get('lst3');
    expect(missing?.type).toBe('Buying');
    expect(missing?.listingTitle).toBeNull();
    expect(missing?.listingPrice).toBeNull();
  });

  it('returns [] without a second round of profile/listing fetches when the view has no rows', async () => {
    mockTables({
      conversation_list: makeQueryBuilder<ConversationListRow[]>({ data: [], error: null }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(result).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('skips the listings fetch when every view row has a null listing_id', async () => {
    const rows = [
      makeConversationListRow({ id: 'm1', listing_id: null, sender_id: 'p1', receiver_id: 'me', partner_id: 'p1' }),
    ];
    mockTables({
      conversation_list: makeQueryBuilder<ConversationListRow[]>({ data: rows, error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(mockFrom).toHaveBeenCalledWith('conversation_list');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).not.toHaveBeenCalledWith('listings');
    expect(result).toHaveLength(1);
    expect(result[0].listingTitle).toBeNull();
    expect(result[0].listingPrice).toBeNull();
  });
});

describe('MessageRepository.getMessages', () => {
  // sender_id/receiver_id are uuid columns; getMessages requires UUID ids
  // because it embeds them into PostgREST's `.or()` filter grammar.
  const PARTNER_ID = '11111111-1111-4111-8111-111111111111';
  const USER_ID = '22222222-2222-4222-8222-222222222222';

  it('queries both message directions ordered oldest-first, filtered by listing_id, and maps rows to domain Messages', async () => {
    const row = makeMessageRow({
      id: 'm1',
      listing_id: 'lst1',
      sender_id: PARTNER_ID,
      receiver_id: USER_ID,
      body: 'Hi',
      read_at: null,
    });
    const messagesBuilder = makeQueryBuilder<MessageRow[]>({ data: [row], error: null });
    mockTables({ messages: messagesBuilder });

    const result = await MessageRepository.getMessages('lst1', PARTNER_ID, USER_ID);

    expect(messagesBuilder.or).toHaveBeenCalledWith(
      `and(sender_id.eq.${USER_ID},receiver_id.eq.${PARTNER_ID}),` +
        `and(sender_id.eq.${PARTNER_ID},receiver_id.eq.${USER_ID})`,
    );
    expect(messagesBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(messagesBuilder.eq).toHaveBeenCalledWith('listing_id', 'lst1');
    expect(messagesBuilder.is).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: 'm1',
        listingId: 'lst1',
        senderId: PARTNER_ID,
        receiverId: USER_ID,
        body: 'Hi',
        createdAt: row.created_at,
        readAt: null,
      },
    ]);
  });

  it('filters by .is(listing_id, null) instead of .eq() when listingId is null', async () => {
    const messagesBuilder = makeQueryBuilder<MessageRow[]>({ data: [], error: null });
    mockTables({ messages: messagesBuilder });

    await MessageRepository.getMessages(null, PARTNER_ID, USER_ID);

    expect(messagesBuilder.is).toHaveBeenCalledWith('listing_id', null);
    expect(messagesBuilder.eq).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID partnerId before issuing any query, so injected PostgREST filter syntax cannot reach `.or()`', async () => {
    const messagesBuilder = makeQueryBuilder<MessageRow[]>({ data: [], error: null });
    mockTables({ messages: messagesBuilder });

    await expect(
      MessageRepository.getMessages('lst1', `${PARTNER_ID}),and(sender_id.eq.${USER_ID}`, USER_ID),
    ).rejects.toThrow(/partnerId must be a UUID/);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('MessageRepository.hasChattedWith', () => {
  // Mirrors the reviews_insert_reviewer policy gate (0020).
  const PARTNER_ID = '11111111-1111-4111-8111-111111111111';
  const USER_ID = '22222222-2222-4222-8222-222222222222';

  it('returns true when a message exists in either direction', async () => {
    const messagesBuilder = makeQueryBuilder<{ id: string }[]>({
      data: [{ id: 'm1' }],
      error: null,
    });
    mockTables({ messages: messagesBuilder });

    const result = await MessageRepository.hasChattedWith(USER_ID, PARTNER_ID);

    expect(messagesBuilder.or).toHaveBeenCalledWith(
      `and(sender_id.eq.${USER_ID},receiver_id.eq.${PARTNER_ID}),` +
        `and(sender_id.eq.${PARTNER_ID},receiver_id.eq.${USER_ID})`,
    );
    expect(messagesBuilder.limit).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it('returns false when no message exists in either direction', async () => {
    const messagesBuilder = makeQueryBuilder<{ id: string }[]>({ data: [], error: null });
    mockTables({ messages: messagesBuilder });

    const result = await MessageRepository.hasChattedWith(USER_ID, PARTNER_ID);

    expect(result).toBe(false);
  });
});

describe('MessageRepository.send', () => {
  it('inserts the client-generated id plus listing/sender/receiver/body and returns the mapped domain Message', async () => {
    const insertedRow = makeMessageRow({
      id: 'm-new',
      listing_id: 'lst1',
      sender_id: 'me',
      receiver_id: 'p1',
      body: 'Is this still available?',
      read_at: null,
    });
    const messagesBuilder = makeQueryBuilder<MessageRow[]>(
      { data: null, error: null },
      { data: insertedRow, error: null },
    );
    mockTables({ messages: messagesBuilder });

    const result = await MessageRepository.send('me', {
      id: 'm-new',
      listingId: 'lst1',
      receiverId: 'p1',
      body: 'Is this still available?',
    });

    expect(messagesBuilder.insert).toHaveBeenCalledWith({
      id: 'm-new',
      listing_id: 'lst1',
      sender_id: 'me',
      receiver_id: 'p1',
      body: 'Is this still available?',
    });
    expect(result).toEqual({
      id: 'm-new',
      listingId: 'lst1',
      senderId: 'me',
      receiverId: 'p1',
      body: 'Is this still available?',
      createdAt: insertedRow.created_at,
      readAt: null,
    });
  });

  it('inserts listing_id: null for a listing-less conversation', async () => {
    const insertedRow = makeMessageRow({ id: 'm-new', listing_id: null });
    const messagesBuilder = makeQueryBuilder<MessageRow[]>(
      { data: null, error: null },
      { data: insertedRow, error: null },
    );
    mockTables({ messages: messagesBuilder });

    await MessageRepository.send('me', {
      id: 'm-new',
      listingId: null,
      receiverId: 'p1',
      body: 'Hey',
    });

    expect(messagesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ listing_id: null }),
    );
  });
});

describe('MessageRepository.markConversationRead', () => {
  it('stamps read_at with an ISO string, scoped to receiver/sender/unread, filtered by listing_id', async () => {
    const messagesBuilder = makeQueryBuilder<null>({ data: null, error: null });
    mockTables({ messages: messagesBuilder });

    await MessageRepository.markConversationRead('lst1', 'p1', 'me');

    expect(messagesBuilder.update).toHaveBeenCalledWith({
      read_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(messagesBuilder.eq).toHaveBeenCalledWith('receiver_id', 'me');
    expect(messagesBuilder.eq).toHaveBeenCalledWith('sender_id', 'p1');
    expect(messagesBuilder.is).toHaveBeenCalledWith('read_at', null);
    expect(messagesBuilder.eq).toHaveBeenCalledWith('listing_id', 'lst1');
  });

  it('filters by .is(listing_id, null) when listingId is null', async () => {
    const messagesBuilder = makeQueryBuilder<null>({ data: null, error: null });
    mockTables({ messages: messagesBuilder });

    await MessageRepository.markConversationRead(null, 'p1', 'me');

    expect(messagesBuilder.is).toHaveBeenCalledWith('listing_id', null);
    expect(messagesBuilder.is).toHaveBeenCalledWith('read_at', null);
  });
});

describe('MessageRepository.subscribeToMessages', () => {
  function makeChannelObj() {
    const channelObj: any = {
      on: jest.fn(() => channelObj),
      subscribe: jest.fn(() => channelObj),
    };
    return channelObj;
  }

  it('registers INSERT and UPDATE postgres_changes listeners on public.messages with no filter', () => {
    const channelObj = makeChannelObj();
    mockChannel.mockReturnValue(channelObj);

    MessageRepository.subscribeToMessages('me', { onInsert: jest.fn(), onUpdate: jest.fn() });

    // Topic carries a per-session suffix so a remount never reuses a
    // still-joined channel (which would throw on the second `.on()`).
    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^messages-me-\d+$/));
    expect(channelObj.on).toHaveBeenCalledTimes(2);

    const [insertConfig] = channelObj.on.mock.calls[0];
    const [updateConfig] = channelObj.on.mock.calls[1];
    expect(insertConfig).toBe('postgres_changes');
    expect(updateConfig).toBe('postgres_changes');

    const insertPayloadConfig = channelObj.on.mock.calls[0][1];
    const updatePayloadConfig = channelObj.on.mock.calls[1][1];
    expect(insertPayloadConfig).toEqual({ event: 'INSERT', schema: 'public', table: 'messages' });
    expect(updatePayloadConfig).toEqual({ event: 'UPDATE', schema: 'public', table: 'messages' });
    expect(insertPayloadConfig).not.toHaveProperty('filter');
    expect(updatePayloadConfig).not.toHaveProperty('filter');
  });

  it('maps an INSERT payload to a domain Message and calls onInsert', () => {
    const channelObj = makeChannelObj();
    mockChannel.mockReturnValue(channelObj);
    const onInsert = jest.fn();
    const onUpdate = jest.fn();

    MessageRepository.subscribeToMessages('me', { onInsert, onUpdate });

    const insertCallback = channelObj.on.mock.calls[0][2];
    const row = makeMessageRow({
      id: 'm-new',
      listing_id: 'lst1',
      sender_id: 'p1',
      receiver_id: 'me',
      body: 'Is this still available?',
      read_at: null,
    });

    insertCallback({ new: row });

    expect(onInsert).toHaveBeenCalledWith({
      id: 'm-new',
      listingId: 'lst1',
      senderId: 'p1',
      receiverId: 'me',
      body: 'Is this still available?',
      createdAt: row.created_at,
      readAt: null,
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('maps an UPDATE payload with a read_at to a domain Message and calls onUpdate', () => {
    const channelObj = makeChannelObj();
    mockChannel.mockReturnValue(channelObj);
    const onInsert = jest.fn();
    const onUpdate = jest.fn();

    MessageRepository.subscribeToMessages('me', { onInsert, onUpdate });

    const updateCallback = channelObj.on.mock.calls[1][2];
    const row = makeMessageRow({
      id: 'm1',
      listing_id: 'lst1',
      sender_id: 'me',
      receiver_id: 'p1',
      body: 'Hello',
      read_at: '2026-07-04T12:00:00.000Z',
    });

    updateCallback({ new: row });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ readAt: '2026-07-04T12:00:00.000Z' }),
    );
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function that calls removeChannel with the channel', () => {
    const channelObj = makeChannelObj();
    mockChannel.mockReturnValue(channelObj);

    const unsubscribe = MessageRepository.subscribeToMessages('me', {
      onInsert: jest.fn(),
      onUpdate: jest.fn(),
    });
    unsubscribe();

    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObj);
  });

  it('uses a distinct channel topic on each subscribe so a re-subscribe never reuses a still-joined channel', () => {
    mockChannel.mockImplementation(() => makeChannelObj());

    MessageRepository.subscribeToMessages('me', { onInsert: jest.fn(), onUpdate: jest.fn() });
    MessageRepository.subscribeToMessages('me', { onInsert: jest.fn(), onUpdate: jest.fn() });

    const firstTopic = mockChannel.mock.calls[0][0];
    const secondTopic = mockChannel.mock.calls[1][0];
    expect(firstTopic).not.toEqual(secondTopic);
  });
});
