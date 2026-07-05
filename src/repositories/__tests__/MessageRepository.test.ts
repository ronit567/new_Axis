// MessageRepository (AX-113): mocks `supabase.from(...)` as a thenable chain,
// same approach as ListingRepository.test.ts, extended with the extra
// chainable methods (or/limit/is/in/update/insert/single) MessageRepository uses.

import type { ListingRow, MessageRow, ProfileRow } from '../../types/database';

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

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'p1',
    name: 'Priya S.',
    initials: 'PS',
    program: 'BMOS',
    year: 2,
    location: 'Elgin Hall',
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
});

describe('MessageRepository.getConversations', () => {
  it('reduces newest-first messages into one conversation per (listing, partner) pair, counting only unread incoming rows', async () => {
    const rows = [
      makeMessageRow({
        id: 'm3',
        listing_id: 'lst1',
        sender_id: 'p1',
        receiver_id: 'me',
        body: 'Newest',
        created_at: '2026-07-03T10:00:00.000Z',
        read_at: null,
      }),
      makeMessageRow({
        id: 'm2',
        listing_id: 'lst1',
        sender_id: 'me',
        receiver_id: 'p1',
        body: 'My reply',
        created_at: '2026-07-02T10:00:00.000Z',
        read_at: null,
      }),
      makeMessageRow({
        id: 'm1',
        listing_id: 'lst1',
        sender_id: 'p1',
        receiver_id: 'me',
        body: 'Oldest',
        created_at: '2026-07-01T10:00:00.000Z',
        read_at: null,
      }),
    ];
    mockTables({
      messages: makeQueryBuilder<MessageRow[]>({ data: rows, error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [makeListingRow({ id: 'lst1', seller_id: 'p1' })],
        error: null,
      }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(result).toHaveLength(1);
    expect(result[0].lastMessage).toBe('Newest');
    // m3 and m1 are unread incoming rows; m2 is outgoing so it doesn't count.
    expect(result[0].unreadCount).toBe(2);
  });

  it('treats the same partner across two different listings as two separate conversations', async () => {
    const rows = [
      makeMessageRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me' }),
      makeMessageRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p1', receiver_id: 'me' }),
    ];
    mockTables({
      messages: makeQueryBuilder<MessageRow[]>({ data: rows, error: null }),
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

  it('returns conversations in last-message-desc order (newest-first scan = Map insertion order)', async () => {
    const rows = [
      makeMessageRow({
        id: 'm1',
        listing_id: 'lst1',
        sender_id: 'p1',
        receiver_id: 'me',
        created_at: '2026-07-03T10:00:00.000Z',
      }),
      makeMessageRow({
        id: 'm2',
        listing_id: 'lst2',
        sender_id: 'p2',
        receiver_id: 'me',
        created_at: '2026-07-02T10:00:00.000Z',
      }),
      makeMessageRow({
        id: 'm3',
        listing_id: 'lst3',
        sender_id: 'p3',
        receiver_id: 'me',
        created_at: '2026-07-01T10:00:00.000Z',
      }),
    ];
    mockTables({
      messages: makeQueryBuilder<MessageRow[]>({ data: rows, error: null }),
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
      makeMessageRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me' }),
      makeMessageRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p2', receiver_id: 'me' }),
    ];
    mockTables({
      messages: makeQueryBuilder<MessageRow[]>({ data: rows, error: null }),
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
      makeMessageRow({ id: 'm1', listing_id: 'lst1', sender_id: 'p1', receiver_id: 'me' }),
      makeMessageRow({ id: 'm2', listing_id: 'lst2', sender_id: 'p2', receiver_id: 'me' }),
      makeMessageRow({ id: 'm3', listing_id: 'lst3', sender_id: 'p3', receiver_id: 'me' }),
    ];
    mockTables({
      messages: makeQueryBuilder<MessageRow[]>({ data: rows, error: null }),
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

  it('returns [] without a second round of profile/listing fetches when there are no messages', async () => {
    mockTables({
      messages: makeQueryBuilder<MessageRow[]>({ data: [], error: null }),
    });

    const result = await MessageRepository.getConversations('me');

    expect(result).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('MessageRepository.getMessages', () => {
  it('queries both message directions ordered oldest-first, filtered by listing_id, and maps rows to domain Messages', async () => {
    const row = makeMessageRow({
      id: 'm1',
      listing_id: 'lst1',
      sender_id: 'p1',
      receiver_id: 'me',
      body: 'Hi',
      read_at: null,
    });
    const messagesBuilder = makeQueryBuilder<MessageRow[]>({ data: [row], error: null });
    mockTables({ messages: messagesBuilder });

    const result = await MessageRepository.getMessages('lst1', 'p1', 'me');

    expect(messagesBuilder.or).toHaveBeenCalledWith(
      'and(sender_id.eq.me,receiver_id.eq.p1),and(sender_id.eq.p1,receiver_id.eq.me)',
    );
    expect(messagesBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(messagesBuilder.eq).toHaveBeenCalledWith('listing_id', 'lst1');
    expect(messagesBuilder.is).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: 'm1',
        listingId: 'lst1',
        senderId: 'p1',
        receiverId: 'me',
        body: 'Hi',
        createdAt: row.created_at,
        readAt: null,
      },
    ]);
  });

  it('filters by .is(listing_id, null) instead of .eq() when listingId is null', async () => {
    const messagesBuilder = makeQueryBuilder<MessageRow[]>({ data: [], error: null });
    mockTables({ messages: messagesBuilder });

    await MessageRepository.getMessages(null, 'p1', 'me');

    expect(messagesBuilder.is).toHaveBeenCalledWith('listing_id', null);
    expect(messagesBuilder.eq).not.toHaveBeenCalled();
  });
});

describe('MessageRepository.send', () => {
  it('inserts listing_id/sender_id/receiver_id/body and returns the mapped domain Message', async () => {
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
      listingId: 'lst1',
      receiverId: 'p1',
      body: 'Is this still available?',
    });

    expect(messagesBuilder.insert).toHaveBeenCalledWith({
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

    await MessageRepository.send('me', { listingId: null, receiverId: 'p1', body: 'Hey' });

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
