// ListingRepository.getAll (AX-201): the only real query in this repository so
// far. Mocks `supabase.from(...)` as a thenable chain (mirrors how the real
// PostgrestFilterBuilder resolves) so we can assert the query shape — active
// only, newest first, category filter, offset pagination — without a live DB.

import type { ListingRow, ProfileRow } from '../../types/database';

type QueryResult<T> = { data: T | null; error: unknown };

function makeQueryBuilder<T>(result: QueryResult<T>) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    in: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    // Terminal methods (mirroring PostgrestFilterBuilder): unlike the chain
    // methods above, these resolve the query themselves rather than
    // returning the builder for further chaining.
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: QueryResult<T>) => unknown) => resolve(result),
  };
  return builder;
}

const mockFrom = jest.fn();
const mockGetSession = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { ListingRepository, LISTINGS_PAGE_SIZE } from '../ListingRepository';

const seller: ProfileRow = {
  id: 'seller-1',
  name: 'Aria K.',
  initials: 'AK',
  program: 'BMOS',
  year: 2,
  location: 'Elgin Hall',
  bio: null,
  avatar_url: null,
  avatar_color: '#5C2D91',
  verified: true,
  reply_time: '~1h',
  created_at: '2024-09-15T10:00:00.000Z',
};

function makeListingRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: 'l1',
    seller_id: seller.id,
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

function mockQueries(opts: {
  listings: QueryResult<ListingRow[]>;
  sellers?: QueryResult<ProfileRow[]>;
  saved?: QueryResult<{ listing_id: string }[]>;
}) {
  const listingsBuilder = makeQueryBuilder(opts.listings);
  const sellersBuilder = makeQueryBuilder(opts.sellers ?? { data: [], error: null });
  const savedBuilder = makeQueryBuilder(opts.saved ?? { data: [], error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'listings') return listingsBuilder;
    if (table === 'profiles') return sellersBuilder;
    if (table === 'saved_listings') return savedBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { listingsBuilder, sellersBuilder, savedBuilder };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('ListingRepository.getAll', () => {
  it('queries active listings newest-first with default pagination', async () => {
    const { listingsBuilder } = mockQueries({
      listings: { data: [makeListingRow()], error: null },
      sellers: { data: [seller], error: null },
    });

    await ListingRepository.getAll('user-1');

    expect(listingsBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(listingsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(listingsBuilder.range).toHaveBeenCalledWith(0, LISTINGS_PAGE_SIZE - 1);
    expect(listingsBuilder.eq).not.toHaveBeenCalledWith('category', expect.anything());
  });

  it('filters by category when provided and offsets by page', async () => {
    const { listingsBuilder } = mockQueries({
      listings: { data: [], error: null },
    });

    await ListingRepository.getAll('user-1', { category: 'Furniture', offset: 40, limit: 20 });

    expect(listingsBuilder.eq).toHaveBeenCalledWith('category', 'Furniture');
    expect(listingsBuilder.range).toHaveBeenCalledWith(40, 59);
  });

  it('maps rows to Listings with per-user saved status', async () => {
    const rowA = makeListingRow({ id: 'l1' });
    const rowB = makeListingRow({ id: 'l2', title: 'Desk lamp' });
    mockQueries({
      listings: { data: [rowA, rowB], error: null },
      sellers: { data: [seller], error: null },
      saved: { data: [{ listing_id: 'l2' }], error: null },
    });

    const result = await ListingRepository.getAll('user-1');

    expect(result.items).toHaveLength(2);
    expect(result.rawCount).toBe(2);
    expect(result.items.find((l) => l.id === 'l1')?.saved).toBe(false);
    expect(result.items.find((l) => l.id === 'l2')?.saved).toBe(true);
  });

  it('returns an empty page without querying sellers/saved when there are no listings', async () => {
    const { sellersBuilder, savedBuilder } = mockQueries({
      listings: { data: [], error: null },
    });

    const result = await ListingRepository.getAll('user-1');

    expect(result).toEqual({ items: [], rawCount: 0 });
    expect(sellersBuilder.select).not.toHaveBeenCalled();
    expect(savedBuilder.select).not.toHaveBeenCalled();
  });

  it('keeps rawCount at the fetched row count even when a seller lookup is missing, so pagination does not stop early', async () => {
    mockQueries({
      listings: { data: [makeListingRow({ id: 'l1' })], error: null },
      sellers: { data: [], error: null },
    });

    const result = await ListingRepository.getAll('user-1');

    expect(result.items).toEqual([]);
    expect(result.rawCount).toBe(1);
  });

  it('throws when the listings query errors', async () => {
    mockQueries({
      listings: { data: null, error: new Error('network down') },
    });

    await expect(ListingRepository.getAll('user-1')).rejects.toThrow('network down');
  });
});

describe('ListingRepository.toggleSaved', () => {
  it('unsaves by deleting when a save row already exists', async () => {
    const savedListingsBuilder = makeQueryBuilder({
      data: [{ listing_id: 'l1' }],
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedListingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingRepository.toggleSaved('l1', 'user-1');

    expect(savedListingsBuilder.delete).toHaveBeenCalled();
    expect(savedListingsBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(savedListingsBuilder.eq).toHaveBeenCalledWith('listing_id', 'l1');
    expect(savedListingsBuilder.insert).not.toHaveBeenCalled();
  });

  it('saves by inserting when no save row was deleted', async () => {
    const savedListingsBuilder = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedListingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingRepository.toggleSaved('l1', 'user-1');

    expect(savedListingsBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      listing_id: 'l1',
    });
  });

  it('throws when the delete errors, without attempting an insert', async () => {
    const savedListingsBuilder = makeQueryBuilder({
      data: null,
      error: new Error('delete failed'),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedListingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.toggleSaved('l1', 'user-1')).rejects.toThrow('delete failed');
    expect(savedListingsBuilder.insert).not.toHaveBeenCalled();
  });

  it('throws when the fallback insert errors', async () => {
    // delete() resolves via the shared builder (empty — nothing to delete);
    // insert() is overridden separately since it must resolve differently.
    const savedListingsBuilder: any = makeQueryBuilder({ data: [], error: null });
    savedListingsBuilder.insert = jest.fn(() => ({
      then: (resolve: (value: QueryResult<unknown>) => unknown) =>
        resolve({ data: null, error: new Error('insert failed') }),
    }));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedListingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.toggleSaved('l1', 'user-1')).rejects.toThrow('insert failed');
  });
});

describe('ListingRepository.getById', () => {
  function mockTables(opts: {
    listing?: QueryResult<ListingRow>;
    seller?: QueryResult<ProfileRow>;
    saved?: QueryResult<{ listing_id: string }>;
  }) {
    const listingBuilder = makeQueryBuilder(opts.listing ?? { data: makeListingRow(), error: null });
    const sellerBuilder = makeQueryBuilder(opts.seller ?? { data: seller, error: null });
    const savedBuilder = makeQueryBuilder(opts.saved ?? { data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingBuilder;
      if (table === 'profiles') return sellerBuilder;
      if (table === 'saved_listings') return savedBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    return { listingBuilder, sellerBuilder, savedBuilder };
  }

  it('returns the listing with its seller when no one is signed in', async () => {
    mockTables({});

    const result = await ListingRepository.getById('l1');

    expect(result?.id).toBe('l1');
    expect(result?.seller.name).toBe(seller.name);
    expect(result?.saved).toBe(false);
  });

  it('returns null when the listing does not exist', async () => {
    mockTables({ listing: { data: null, error: null } });

    const result = await ListingRepository.getById('missing');

    expect(result).toBeNull();
  });

  it('returns null when the seller lookup comes back empty (broken reference)', async () => {
    mockTables({ seller: { data: null, error: null } });

    const result = await ListingRepository.getById('l1');

    expect(result).toBeNull();
  });

  it('marks the listing saved for the signed-in viewer who saved it', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockTables({ saved: { data: { listing_id: 'l1' }, error: null } });

    const result = await ListingRepository.getById('l1');

    expect(result?.saved).toBe(true);
  });

  it('does not query saved_listings when no one is signed in', async () => {
    const { savedBuilder } = mockTables({});

    await ListingRepository.getById('l1');

    expect(savedBuilder.select).not.toHaveBeenCalled();
  });

  it('throws when the listing query errors', async () => {
    mockTables({ listing: { data: null, error: new Error('network down') } });

    await expect(ListingRepository.getById('l1')).rejects.toThrow('network down');
  });
});

describe('ListingRepository.create', () => {
  const input = {
    title: 'Desk lamp',
    description: 'Barely used',
    price: 15,
    is_free: false,
    is_trade: false,
    condition: 'Good' as const,
    category: 'Furniture',
    pickup: 'UCC',
    image_urls: [],
  };

  it('inserts under the given seller and returns the mapped listing', async () => {
    const listingsBuilder = makeQueryBuilder({
      data: makeListingRow({ id: 'new-listing', ...input }),
      error: null,
    });
    const sellersBuilder = makeQueryBuilder({ data: seller, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return sellersBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.create(seller.id, input);

    expect(listingsBuilder.insert).toHaveBeenCalledWith({ seller_id: seller.id, ...input });
    expect(result.id).toBe('new-listing');
    expect(result.saved).toBe(false);
  });

  it('throws when the insert errors', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: new Error('insert failed') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.create(seller.id, input)).rejects.toThrow('insert failed');
  });
});

describe('ListingRepository.getSavedByUser', () => {
  it('returns saved listings newest-saved-first', async () => {
    const rowA = makeListingRow({ id: 'l1' });
    const rowB = makeListingRow({ id: 'l2', title: 'Desk lamp' });
    const savedBuilder = makeQueryBuilder({
      data: [{ listing_id: 'l2' }, { listing_id: 'l1' }],
      error: null,
    });
    const listingsBuilder = makeQueryBuilder({ data: [rowA, rowB], error: null });
    const sellersBuilder = makeQueryBuilder({ data: [seller], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedBuilder;
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return sellersBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(listingsBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(result.map((l) => l.id)).toEqual(['l2', 'l1']);
    expect(result.every((l) => l.saved)).toBe(true);
  });

  it('excludes a saved listing that has since sold, matching getAll', async () => {
    // The listings query is filtered server-side by `.eq('status', 'active')`;
    // the mock just needs to reflect what an active-only filter would return
    // (the sold row simply isn't in the result set).
    const savedBuilder = makeQueryBuilder({
      data: [{ listing_id: 'l1' }, { listing_id: 'l2' }],
      error: null,
    });
    const listingsBuilder = makeQueryBuilder({
      data: [makeListingRow({ id: 'l1', status: 'active' })],
      error: null,
    });
    const sellersBuilder = makeQueryBuilder({ data: [seller], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedBuilder;
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return sellersBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result.map((l) => l.id)).toEqual(['l1']);
  });

  it('returns an empty list without querying listings/sellers when nothing is saved', async () => {
    const savedBuilder = makeQueryBuilder({ data: [], error: null });
    const listingsBuilder = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedBuilder;
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result).toEqual([]);
    expect(listingsBuilder.select).not.toHaveBeenCalled();
  });

  it('skips a saved listing that no longer exists instead of throwing', async () => {
    const rowA = makeListingRow({ id: 'l1' });
    const savedBuilder = makeQueryBuilder({
      data: [{ listing_id: 'l1' }, { listing_id: 'deleted' }],
      error: null,
    });
    const listingsBuilder = makeQueryBuilder({ data: [rowA], error: null });
    const sellersBuilder = makeQueryBuilder({ data: [seller], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedBuilder;
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return sellersBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result.map((l) => l.id)).toEqual(['l1']);
  });

  it('throws when the saved_listings query errors', async () => {
    const savedBuilder = makeQueryBuilder({ data: null, error: new Error('network down') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.getSavedByUser('user-1')).rejects.toThrow('network down');
  });
});

describe('ListingRepository.incrementViews', () => {
  // Goes through the increment_listing_views RPC (migration 0006), not a plain
  // update() — listings_update_own scopes UPDATE to the seller, so a non-owner
  // viewer's update() would silently affect 0 rows under RLS. The RPC is
  // SECURITY DEFINER and does the increment atomically in one SQL statement.
  it('calls the increment_listing_views RPC with the listing id', async () => {
    await ListingRepository.incrementViews('l1');

    expect(mockRpc).toHaveBeenCalledWith('increment_listing_views', { listing_id: 'l1' });
  });

  it('throws when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(ListingRepository.incrementViews('l1')).rejects.toThrow('network down');
  });
});
