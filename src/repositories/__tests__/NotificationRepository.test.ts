// NotificationRepository (AX-601/602): mocks `supabase.from(...)` as a
// thenable chain, same approach as MessageRepository.test.ts, extended with a
// `count` field on the resolved result so head-count queries (unreadCount)
// resolve correctly.

import type { ListingRow, NotificationRow, ProfileRow } from '../../types/database';

type QueryResult<T> = { data: T | null; error: unknown; count?: number };

function makeQueryBuilder<T>(result: QueryResult<T>) {
  const builder: any = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    update: jest.fn(() => builder),
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

import { NotificationRepository } from '../NotificationRepository';

function makeNotificationRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: 'n1',
    user_id: 'me',
    type: 'message',
    actor_id: 'p1',
    listing_id: 'lst1',
    read: false,
    read_at: null,
    created_at: '2026-07-01T10:00:00.000Z',
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

describe('NotificationRepository.list', () => {
  it("queries the user's notifications newest-first with a limit and maps rows", async () => {
    const row = makeNotificationRow({ id: 'n1' });
    const notificationsBuilder = makeQueryBuilder<NotificationRow[]>({ data: [row], error: null });
    mockTables({
      notifications: notificationsBuilder,
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
      listings: makeQueryBuilder<ListingRow[]>({ data: [makeListingRow({ id: 'lst1' })], error: null }),
    });

    const result = await NotificationRepository.list('me', 10);

    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(notificationsBuilder.eq).toHaveBeenCalledWith('user_id', 'me');
    expect(notificationsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(notificationsBuilder.limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('batch-joins actor profiles and listings and composes the message copy', async () => {
    const row = makeNotificationRow({
      id: 'n1',
      type: 'listing_saved',
      actor_id: 'p1',
      listing_id: 'lst1',
    });
    mockTables({
      notifications: makeQueryBuilder<NotificationRow[]>({ data: [row], error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({
        data: [makeProfileRow({ id: 'p1', name: 'Priya S.' })],
        error: null,
      }),
      listings: makeQueryBuilder<ListingRow[]>({
        data: [makeListingRow({ id: 'lst1', title: 'Organic Chem 2 textbook' })],
        error: null,
      }),
    });

    const result = await NotificationRepository.list('me');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(result[0].actor?.name).toBe('Priya S.');
    expect(result[0].listingTitle).toBe('Organic Chem 2 textbook');
    expect(result[0].message).toBe('Priya S. saved your listing "Organic Chem 2 textbook"');
  });

  it("drops a notification whose actor profile is missing", async () => {
    const rows = [
      makeNotificationRow({ id: 'n1', actor_id: 'p1' }),
      makeNotificationRow({ id: 'n2', actor_id: 'p2' }),
    ];
    mockTables({
      notifications: makeQueryBuilder<NotificationRow[]>({ data: rows, error: null }),
      // p2 is absent from the profiles response.
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
      listings: makeQueryBuilder<ListingRow[]>({ data: [makeListingRow({ id: 'lst1' })], error: null }),
    });

    const result = await NotificationRepository.list('me');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('returns [] without secondary fetches when there are no rows', async () => {
    mockTables({
      notifications: makeQueryBuilder<NotificationRow[]>({ data: [], error: null }),
    });

    const result = await NotificationRepository.list('me');

    expect(result).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('skips the listings fetch when no row has a listing_id', async () => {
    const row = makeNotificationRow({ id: 'n1', listing_id: null });
    mockTables({
      notifications: makeQueryBuilder<NotificationRow[]>({ data: [row], error: null }),
      profiles: makeQueryBuilder<ProfileRow[]>({ data: [makeProfileRow({ id: 'p1' })], error: null }),
    });

    const result = await NotificationRepository.list('me');

    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).not.toHaveBeenCalledWith('listings');
    expect(result).toHaveLength(1);
    expect(result[0].listingTitle).toBeNull();
  });

  it('propagates an error from the notifications query', async () => {
    mockTables({
      notifications: makeQueryBuilder<NotificationRow[]>({ data: null, error: new Error('boom') }),
    });

    await expect(NotificationRepository.list('me')).rejects.toThrow('boom');
  });
});

describe('NotificationRepository.unreadCount', () => {
  it('returns the head count of unread rows', async () => {
    const notificationsBuilder = makeQueryBuilder<null>({ data: null, error: null, count: 3 });
    mockTables({ notifications: notificationsBuilder });

    const result = await NotificationRepository.unreadCount('me');

    expect(notificationsBuilder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(notificationsBuilder.eq).toHaveBeenCalledWith('user_id', 'me');
    expect(notificationsBuilder.eq).toHaveBeenCalledWith('read', false);
    expect(result).toBe(3);
  });

  it('returns 0 when count is null', async () => {
    mockTables({
      notifications: makeQueryBuilder<null>({ data: null, error: null, count: null as unknown as number }),
    });

    const result = await NotificationRepository.unreadCount('me');

    expect(result).toBe(0);
  });

  it('propagates an error from the count query', async () => {
    mockTables({
      notifications: makeQueryBuilder<null>({ data: null, error: new Error('boom') }),
    });

    await expect(NotificationRepository.unreadCount('me')).rejects.toThrow('boom');
  });
});

describe('NotificationRepository.markRead', () => {
  it('sets read and stamps read_at for the id', async () => {
    const notificationsBuilder = makeQueryBuilder<null>({ data: null, error: null });
    mockTables({ notifications: notificationsBuilder });

    await NotificationRepository.markRead('n1');

    expect(notificationsBuilder.update).toHaveBeenCalledWith({
      read: true,
      read_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(notificationsBuilder.eq).toHaveBeenCalledWith('id', 'n1');
  });

  it('propagates an error from the update', async () => {
    mockTables({
      notifications: makeQueryBuilder<null>({ data: null, error: new Error('boom') }),
    });

    await expect(NotificationRepository.markRead('n1')).rejects.toThrow('boom');
  });
});

describe('NotificationRepository.markAllRead', () => {
  it('marks every unread row of the user read', async () => {
    const notificationsBuilder = makeQueryBuilder<null>({ data: null, error: null });
    mockTables({ notifications: notificationsBuilder });

    await NotificationRepository.markAllRead('me');

    expect(notificationsBuilder.update).toHaveBeenCalledWith({
      read: true,
      read_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(notificationsBuilder.eq).toHaveBeenCalledWith('user_id', 'me');
    expect(notificationsBuilder.eq).toHaveBeenCalledWith('read', false);
  });

  it('propagates an error from the update', async () => {
    mockTables({
      notifications: makeQueryBuilder<null>({ data: null, error: new Error('boom') }),
    });

    await expect(NotificationRepository.markAllRead('me')).rejects.toThrow('boom');
  });
});
