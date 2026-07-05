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
    maybeSingle: jest.fn(() => builder),
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

describe('ListingRepository.getById', () => {
  function mockGetByIdQueries(opts: {
    listing: QueryResult<ListingRow | null>;
    seller?: QueryResult<ProfileRow | null>;
    saved?: QueryResult<{ listing_id: string } | null>;
  }) {
    const listingBuilder = makeQueryBuilder(opts.listing);
    const sellerBuilder = makeQueryBuilder(opts.seller ?? { data: null, error: null });
    const savedBuilder = makeQueryBuilder(opts.saved ?? { data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingBuilder;
      if (table === 'profiles') return sellerBuilder;
      if (table === 'saved_listings') return savedBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    return { listingBuilder, sellerBuilder, savedBuilder };
  }

  it('fetches a listing by id with its seller and saved status', async () => {
    const { listingBuilder, sellerBuilder } = mockGetByIdQueries({
      listing: { data: makeListingRow(), error: null },
      seller: { data: seller, error: null },
      saved: { data: { listing_id: 'l1' }, error: null },
    });

    const result = await ListingRepository.getById('l1', 'user-1');

    expect(listingBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    expect(sellerBuilder.eq).toHaveBeenCalledWith('id', seller.id);
    expect(result?.id).toBe('l1');
    expect(result?.saved).toBe(true);
  });

  it('returns null with a friendly not-found result when the listing was deleted', async () => {
    mockGetByIdQueries({ listing: { data: null, error: null } });

    const result = await ListingRepository.getById('missing-id', 'user-1');

    expect(result).toBeNull();
  });

  it('returns null when the seller reference is broken', async () => {
    mockGetByIdQueries({
      listing: { data: makeListingRow(), error: null },
      seller: { data: null, error: null },
    });

    const result = await ListingRepository.getById('l1', 'user-1');

    expect(result).toBeNull();
  });

  it('throws when the listing query errors', async () => {
    mockGetByIdQueries({ listing: { data: null, error: new Error('network down') } });

    await expect(ListingRepository.getById('l1', 'user-1')).rejects.toThrow('network down');
  });

  it('throws when the seller query errors', async () => {
    mockGetByIdQueries({
      listing: { data: makeListingRow(), error: null },
      seller: { data: null, error: new Error('seller lookup failed') },
    });

    await expect(ListingRepository.getById('l1', 'user-1')).rejects.toThrow('seller lookup failed');
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
