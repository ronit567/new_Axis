// ListingRepository tests. getAll + toggleSaved (AX-201, home feed) assert query
// shape via jest.fn spies (makeQueryBuilder); search (AX-204) asserts the exact
// filter arguments via a call-recording builder (createSearchBuilder). Both
// suites drive the single mocked `supabase.from(...)`, which resolves as a
// thenable chain the way the real PostgrestFilterBuilder does — no live DB.

import type { ListingRow, ProfileRow } from '../../types/database';

type QueryResult<T> = { data: T | null; error: unknown };

function makeQueryBuilder<T>(result: QueryResult<T>) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
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

import {
  ListingRepository,
  LISTINGS_PAGE_SIZE,
  SEARCH_PAGE_SIZE,
  type CreateListingInput,
} from '../ListingRepository';

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

  it("excludes the caller's own listings so they don't appear in their own feed", async () => {
    const { listingsBuilder } = mockQueries({
      listings: { data: [makeListingRow()], error: null },
      sellers: { data: [seller], error: null },
    });

    await ListingRepository.getAll('user-1');

    expect(listingsBuilder.neq).toHaveBeenCalledWith('seller_id', 'user-1');
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

const validCreateInput: CreateListingInput = {
  title: 'Desk lamp',
  description: 'Works great',
  price: 15,
  is_free: false,
  is_trade: false,
  condition: 'Good',
  category: 'Furniture',
  pickup: 'UCC, Room 110',
  image_urls: ['https://example.com/a.jpg'],
};

describe('ListingRepository.create', () => {
  it('inserts with the caller-provided id/seller_id and maps the row with a seller join', async () => {
    const row = makeListingRow({ id: 'new-listing-id', seller_id: seller.id, ...validCreateInput });
    const listingsBuilder = makeQueryBuilder({ data: row, error: null });
    const profilesBuilder = makeQueryBuilder({ data: seller, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.create(seller.id, 'new-listing-id', validCreateInput);

    expect(listingsBuilder.insert).toHaveBeenCalledWith({
      id: 'new-listing-id',
      seller_id: seller.id,
      ...validCreateInput,
    });
    expect(profilesBuilder.eq).toHaveBeenCalledWith('id', seller.id);
    expect(result.id).toBe('new-listing-id');
    // Nothing can have saved a listing in the instant it's created.
    expect(result.saved).toBe(false);
  });

  it('throws when the insert errors, without querying the seller profile', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: new Error('insert failed') });
    const profilesBuilder = makeQueryBuilder({ data: seller, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      ListingRepository.create(seller.id, 'l1', validCreateInput),
    ).rejects.toThrow('insert failed');
    expect(profilesBuilder.select).not.toHaveBeenCalled();
  });

  it('throws when the seller profile lookup errors', async () => {
    const row = makeListingRow({ id: 'l1' });
    const listingsBuilder = makeQueryBuilder({ data: row, error: null });
    const profilesBuilder = makeQueryBuilder({
      data: null,
      error: new Error('profile lookup failed'),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      ListingRepository.create(seller.id, 'l1', validCreateInput),
    ).rejects.toThrow('profile lookup failed');
  });
});

describe('ListingRepository.getBySeller', () => {
  it('returns own listings across all statuses, newest first, with per-listing save counts from the RPC', async () => {
    const rowA = makeListingRow({ id: 'l1', status: 'active' });
    const rowB = makeListingRow({ id: 'l2', status: 'sold', price: 30 });
    const listingsBuilder = makeQueryBuilder({ data: [rowA, rowB], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    // saved_listings RLS only lets a direct table query see the caller's own
    // rows, so the real count-across-users comes from this RPC instead
    // (see ListingRepository.getBySeller / migration 0006) — not a `from()` call.
    mockRpc.mockResolvedValue({
      data: [
        { listing_id: 'l1', saves: 2 },
        { listing_id: 'l2', saves: 1 },
      ],
      error: null,
    });

    const result = await ListingRepository.getBySeller(seller.id);

    expect(listingsBuilder.eq).toHaveBeenCalledWith('seller_id', seller.id);
    expect(listingsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockRpc).toHaveBeenCalledWith('my_listing_save_counts');
    expect(result).toHaveLength(2);
    expect(result.find((l) => l.id === 'l1')?.saves).toBe(2);
    expect(result.find((l) => l.id === 'l2')?.saves).toBe(1);
    expect(result.find((l) => l.id === 'l2')?.status).toBe('sold');
    expect(result.find((l) => l.id === 'l2')?.soldFor).toBe(30);
  });

  it('returns an empty list without calling the save-counts RPC when the seller has no listings', async () => {
    const listingsBuilder = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingRepository.getBySeller(seller.id);

    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('throws when the listings query errors', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: new Error('network down') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.getBySeller(seller.id)).rejects.toThrow('network down');
  });

  it('still returns the listings (with 0 saves) when the save-counts RPC errors', async () => {
    // Save counts are secondary metadata; a failing/absent RPC must not zero
    // out the owner's own-listings view (the Profile-shows-empty bug). The
    // listings still load, just with saves defaulted to 0.
    const listingsBuilder = makeQueryBuilder({
      data: [makeListingRow({ id: 'l1' }), makeListingRow({ id: 'l2' })],
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const result = await ListingRepository.getBySeller(seller.id);

    expect(result.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(result.every((l) => l.saves === 0)).toBe(true);
  });
});

describe('ListingRepository.getActiveBySeller', () => {
  function mockStorefrontQueries(opts: {
    listings: QueryResult<ListingRow[]>;
    seller?: QueryResult<ProfileRow | null>;
    saved?: QueryResult<{ listing_id: string }[]>;
  }) {
    const listingsBuilder = makeQueryBuilder(opts.listings);
    const profilesBuilder = makeQueryBuilder(opts.seller ?? { data: seller, error: null });
    const savedBuilder = makeQueryBuilder(opts.saved ?? { data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return profilesBuilder;
      if (table === 'saved_listings') return savedBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    return { listingsBuilder, profilesBuilder, savedBuilder };
  }

  it("returns only the seller's active listings, newest first, with the viewer's saved flags", async () => {
    const { listingsBuilder, savedBuilder } = mockStorefrontQueries({
      listings: { data: [makeListingRow({ id: 'l1' }), makeListingRow({ id: 'l2' })], error: null },
      saved: { data: [{ listing_id: 'l2' }], error: null },
    });

    const result = await ListingRepository.getActiveBySeller(seller.id, 'viewer-1');

    expect(listingsBuilder.eq).toHaveBeenCalledWith('seller_id', seller.id);
    expect(listingsBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(listingsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(savedBuilder.eq).toHaveBeenCalledWith('user_id', 'viewer-1');
    expect(result.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(result.find((l) => l.id === 'l2')?.saved).toBe(true);
    expect(result.find((l) => l.id === 'l1')?.saved).toBe(false);
  });

  it('returns an empty list without profile/saved queries when the seller has no active listings', async () => {
    const { profilesBuilder } = mockStorefrontQueries({ listings: { data: [], error: null } });

    const result = await ListingRepository.getActiveBySeller(seller.id, 'viewer-1');

    expect(result).toEqual([]);
    expect(profilesBuilder.select).not.toHaveBeenCalled();
  });

  it('returns an empty list when the seller profile reference is broken', async () => {
    mockStorefrontQueries({
      listings: { data: [makeListingRow({ id: 'l1' })], error: null },
      seller: { data: null, error: null },
    });

    const result = await ListingRepository.getActiveBySeller(seller.id, 'viewer-1');

    expect(result).toEqual([]);
  });

  it('throws when the listings query errors', async () => {
    mockStorefrontQueries({ listings: { data: null, error: new Error('network down') } });

    await expect(ListingRepository.getActiveBySeller(seller.id, 'viewer-1')).rejects.toThrow(
      'network down',
    );
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

// ── search (AX-204): server-side text/category/price/condition filtering ─────
// The search query is a single chain (embedded seller join), so this builder
// records every filter call in `builder.calls` and resolves the configured
// `result` when awaited — letting the tests assert the exact filter arguments.
type SearchQueryResult = { data: any; error: any };

function createSearchBuilder(result: SearchQueryResult) {
  const calls: Record<string, any[][]> = {};
  const record = (name: string, args: any[]) => {
    calls[name] = calls[name] || [];
    calls[name].push(args);
  };
  const builder: any = {
    select: (...args: any[]) => { record('select', args); return builder; },
    eq: (...args: any[]) => { record('eq', args); return builder; },
    neq: (...args: any[]) => { record('neq', args); return builder; },
    ilike: (...args: any[]) => { record('ilike', args); return builder; },
    or: (...args: any[]) => { record('or', args); return builder; },
    in: (...args: any[]) => { record('in', args); return builder; },
    lte: (...args: any[]) => { record('lte', args); return builder; },
    order: (...args: any[]) => { record('order', args); return builder; },
    range: (...args: any[]) => { record('range', args); return builder; },
    then: (resolve: (r: SearchQueryResult) => unknown) => resolve(result),
    calls,
  };
  return builder;
}

let searchListingsResult: SearchQueryResult = { data: [], error: null };
let searchSavedResult: SearchQueryResult = { data: [], error: null };
let searchListingsBuilder: any;
let searchSavedBuilder: any;

const searchSeller = {
  id: 's1',
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

// search selects the seller embedded on each row (profiles join), so the mock
// row carries `seller` inline rather than relying on a separate profiles query.
function makeSearchRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'l1',
    seller_id: 's1',
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
    seller: searchSeller,
    ...overrides,
  };
}

describe('ListingRepository.search', () => {
  beforeEach(() => {
    searchListingsResult = { data: [], error: null };
    searchSavedResult = { data: [], error: null };
    searchListingsBuilder = undefined;
    searchSavedBuilder = undefined;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') {
        searchListingsBuilder = createSearchBuilder(searchListingsResult);
        return searchListingsBuilder;
      }
      if (table === 'saved_listings') {
        searchSavedBuilder = createSearchBuilder(searchSavedResult);
        return searchSavedBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('always scopes to active listings, newest first, with default pagination', async () => {
    await ListingRepository.search('', {});
    expect(searchListingsBuilder.calls.eq).toEqual([['status', 'active']]);
    expect(searchListingsBuilder.calls.order).toEqual([['created_at', { ascending: false }]]);
    expect(searchListingsBuilder.calls.range).toEqual([[0, SEARCH_PAGE_SIZE - 1]]);
    expect(searchListingsBuilder.calls.or).toBeUndefined();
    expect(searchListingsBuilder.calls.in).toBeUndefined();
    expect(searchListingsBuilder.calls.lte).toBeUndefined();
  });

  it('offsets by page when a later page is requested', async () => {
    await ListingRepository.search('', {}, undefined, { offset: 40, limit: 20 });
    expect(searchListingsBuilder.calls.range).toEqual([[40, 59]]);
  });

  it('matches a trimmed text query against title OR description', async () => {
    await ListingRepository.search('  chem  ', {});
    expect(searchListingsBuilder.calls.or).toEqual([
      ['title.ilike."%chem%",description.ilike."%chem%"'],
    ]);
  });

  it('omits the text filter for an empty/whitespace-only query', async () => {
    await ListingRepository.search('   ', {});
    expect(searchListingsBuilder.calls.or).toBeUndefined();
  });

  it('escapes LIKE metacharacters and quotes the value so commas/quotes cannot break the or() filter', async () => {
    // Input contains a comma (PostgREST separator), a percent + underscore
    // (LIKE wildcards), and a backslash — all of which must survive as literal
    // characters inside the or() filter string.
    await ListingRepository.search('a,b%c_d\\', {});
    // LIKE-escaped:  a,b\%c\_d\\   ->  pattern  %a,b\%c\_d\\%
    // then backslashes doubled for the quoted or() value.
    const value = '"%a,b\\\\%c\\\\_d\\\\\\\\%"';
    expect(searchListingsBuilder.calls.or).toEqual([
      [`title.ilike.${value},description.ilike.${value}`],
    ]);
  });

  it('applies the category filter via an IN clause', async () => {
    await ListingRepository.search('', { categories: ['Textbooks', 'Electronics'] });
    expect(searchListingsBuilder.calls.in).toEqual([['category', ['Textbooks', 'Electronics']]]);
  });

  it('applies the price-max filter', async () => {
    await ListingRepository.search('', { priceMax: 50 });
    expect(searchListingsBuilder.calls.lte).toEqual([['price', 50]]);
  });

  it('applies the condition filter', async () => {
    await ListingRepository.search('', { condition: 'Good' });
    expect(searchListingsBuilder.calls.eq).toEqual([['status', 'active'], ['condition', 'Good']]);
  });

  it('combines text, category, price-max, and condition filters together', async () => {
    await ListingRepository.search('chem', {
      categories: ['Textbooks'],
      priceMax: 60,
      condition: 'Good',
    });
    expect(searchListingsBuilder.calls.or).toEqual([
      ['title.ilike."%chem%",description.ilike."%chem%"'],
    ]);
    expect(searchListingsBuilder.calls.in).toEqual([['category', ['Textbooks']]]);
    expect(searchListingsBuilder.calls.lte).toEqual([['price', 60]]);
    expect(searchListingsBuilder.calls.eq).toEqual([['status', 'active'], ['condition', 'Good']]);
  });

  it('returns an accurate, empty result with no matches (and skips the saved-ids lookup)', async () => {
    searchListingsResult = { data: [], error: null };
    const result = await ListingRepository.search('nonexistent', {});
    expect(result).toEqual({ items: [], rawCount: 0 });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('listings');
  });

  it('maps matching rows into domain Listings with an accurate count', async () => {
    searchListingsResult = {
      data: [makeSearchRow({ id: 'l1' }), makeSearchRow({ id: 'l2', title: 'Calc textbook' })],
      error: null,
    };
    const result = await ListingRepository.search('textbook', {});
    expect(result.items).toHaveLength(2);
    expect(result.rawCount).toBe(2);
    expect(result.items.map((r) => r.id)).toEqual(['l1', 'l2']);
    expect(result.items[0].seller.id).toBe('s1');
  });

  it('skips a row whose embedded seller is null (broken FK) instead of throwing, keeping rawCount at the fetched row count', async () => {
    searchListingsResult = {
      data: [makeSearchRow({ id: 'l1', seller: null }), makeSearchRow({ id: 'l2' })],
      error: null,
    };
    const result = await ListingRepository.search('', {});
    expect(result.items.map((r) => r.id)).toEqual(['l2']);
    expect(result.rawCount).toBe(2);
  });

  it('defaults saved to false when no current user is given', async () => {
    searchListingsResult = { data: [makeSearchRow({ id: 'l1' })], error: null };
    const { items: [result] } = await ListingRepository.search('', {});
    expect(result.saved).toBe(false);
    expect(mockFrom).not.toHaveBeenCalledWith('saved_listings');
  });

  it('folds in the current user\'s saved-ids scoped to the result set', async () => {
    searchListingsResult = {
      data: [makeSearchRow({ id: 'l1' }), makeSearchRow({ id: 'l2' })],
      error: null,
    };
    searchSavedResult = { data: [{ listing_id: 'l1' }], error: null };

    const { items } = await ListingRepository.search('', {}, 'u1');

    expect(items.find((r) => r.id === 'l1')?.saved).toBe(true);
    expect(items.find((r) => r.id === 'l2')?.saved).toBe(false);
    expect(searchSavedBuilder.calls.eq).toEqual([['user_id', 'u1']]);
    expect(searchSavedBuilder.calls.in).toEqual([['listing_id', ['l1', 'l2']]]);
  });

  it("excludes the caller's own listings, same as the home feed, when a user is given", async () => {
    await ListingRepository.search('', {}, 'u1');
    expect(searchListingsBuilder.calls.neq).toEqual([['seller_id', 'u1']]);
  });

  it('does not filter by seller for a signed-out search (no current user)', async () => {
    await ListingRepository.search('', {});
    expect(searchListingsBuilder.calls.neq).toBeUndefined();
  });

  it('throws when the listings query errors', async () => {
    searchListingsResult = { data: null, error: new Error('boom') };
    await expect(ListingRepository.search('', {})).rejects.toThrow('boom');
  });

  it('throws when the saved-ids query errors', async () => {
    searchListingsResult = { data: [makeSearchRow({ id: 'l1' })], error: null };
    searchSavedResult = { data: null, error: new Error('saved-ids boom') };
    await expect(ListingRepository.search('', {}, 'u1')).rejects.toThrow('saved-ids boom');
  });
});

describe('ListingRepository.getSavedByUser', () => {
  function mockSavedQueries(opts: {
    saved: QueryResult<{ listing_id: string }[]>;
    listings?: QueryResult<ListingRow[]>;
    sellers?: QueryResult<ProfileRow[]>;
  }) {
    const savedBuilder = makeQueryBuilder(opts.saved);
    const listingsBuilder = makeQueryBuilder(opts.listings ?? { data: [], error: null });
    const sellersBuilder = makeQueryBuilder(opts.sellers ?? { data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'saved_listings') return savedBuilder;
      if (table === 'listings') return listingsBuilder;
      if (table === 'profiles') return sellersBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    return { savedBuilder, listingsBuilder, sellersBuilder };
  }

  it('returns an empty list without querying listings/sellers when nothing is saved', async () => {
    const { listingsBuilder, sellersBuilder } = mockSavedQueries({
      saved: { data: [], error: null },
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result).toEqual([]);
    expect(listingsBuilder.select).not.toHaveBeenCalled();
    expect(sellersBuilder.select).not.toHaveBeenCalled();
  });

  it('maps saved rows to Listings, all marked saved, in most-recently-saved order', async () => {
    const rowA = makeListingRow({ id: 'l1', title: 'Organic Chem 2 textbook' });
    const rowB = makeListingRow({ id: 'l2', title: 'Desk lamp', seller_id: 'seller-2' });
    const seller2: ProfileRow = { ...seller, id: 'seller-2', name: 'Liam' };
    mockSavedQueries({
      // saved_listings is ordered by created_at desc, so l2 was saved more
      // recently than l1 even though the listings query below returns them
      // in a different (arbitrary) order.
      saved: { data: [{ listing_id: 'l2' }, { listing_id: 'l1' }], error: null },
      listings: { data: [rowA, rowB], error: null },
      sellers: { data: [seller, seller2], error: null },
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result.map((l) => l.id)).toEqual(['l2', 'l1']);
    expect(result.every((l) => l.saved)).toBe(true);
  });

  it('filters saved listings to active status, same as the home feed', async () => {
    const { listingsBuilder } = mockSavedQueries({
      saved: { data: [{ listing_id: 'l1' }], error: null },
      listings: { data: [makeListingRow({ id: 'l1' })], error: null },
      sellers: { data: [seller], error: null },
    });

    await ListingRepository.getSavedByUser('user-1');

    expect(listingsBuilder.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('skips a saved listing whose seller is missing rather than throwing', async () => {
    const row = makeListingRow({ id: 'l1' });
    mockSavedQueries({
      saved: { data: [{ listing_id: 'l1' }], error: null },
      listings: { data: [row], error: null },
      sellers: { data: [], error: null },
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result).toEqual([]);
  });

  it('skips a saved listing that no longer exists instead of throwing', async () => {
    mockSavedQueries({
      saved: { data: [{ listing_id: 'l1' }, { listing_id: 'deleted' }], error: null },
      listings: { data: [makeListingRow({ id: 'l1' })], error: null },
      sellers: { data: [seller], error: null },
    });

    const result = await ListingRepository.getSavedByUser('user-1');

    expect(result.map((l) => l.id)).toEqual(['l1']);
  });

  it('throws when the saved_listings query errors', async () => {
    mockSavedQueries({ saved: { data: null, error: new Error('network down') } });

    await expect(ListingRepository.getSavedByUser('user-1')).rejects.toThrow('network down');
  });

  it('throws when the listings query errors', async () => {
    mockSavedQueries({
      saved: { data: [{ listing_id: 'l1' }], error: null },
      listings: { data: null, error: new Error('listings down') },
    });

    await expect(ListingRepository.getSavedByUser('user-1')).rejects.toThrow('listings down');
  });

  it('throws when the sellers query errors', async () => {
    mockSavedQueries({
      saved: { data: [{ listing_id: 'l1' }], error: null },
      listings: { data: [makeListingRow({ id: 'l1' })], error: null },
      sellers: { data: null, error: new Error('sellers down') },
    });

    await expect(ListingRepository.getSavedByUser('user-1')).rejects.toThrow('sellers down');
  });
});

describe('ListingRepository.incrementViews', () => {
  // Goes through the increment_listing_views RPC (migration 0007), not a plain
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

describe('ListingRepository.markSold', () => {
  it('updates status to sold scoped to the owner', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingRepository.markSold('l1', seller.id);

    expect(listingsBuilder.update).toHaveBeenCalledWith({ status: 'sold' });
    expect(listingsBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    expect(listingsBuilder.eq).toHaveBeenCalledWith('seller_id', seller.id);
  });

  it('throws when the update errors', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: new Error('update failed') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.markSold('l1', seller.id)).rejects.toThrow('update failed');
  });
});

describe('ListingRepository.relist', () => {
  it('updates status to active scoped to the owner', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingRepository.relist('l1', seller.id);

    expect(listingsBuilder.update).toHaveBeenCalledWith({ status: 'active' });
    expect(listingsBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    expect(listingsBuilder.eq).toHaveBeenCalledWith('seller_id', seller.id);
  });

  it('throws when the update errors', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: new Error('update failed') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.relist('l1', seller.id)).rejects.toThrow('update failed');
  });
});

describe('ListingRepository.updateListing', () => {
  it('updates the given patch scoped to the owner', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingRepository.updateListing('l1', seller.id, {
      price: 20,
      description: 'Updated',
      pickup: 'Student center',
    });

    expect(listingsBuilder.update).toHaveBeenCalledWith({
      price: 20,
      description: 'Updated',
      pickup: 'Student center',
    });
    expect(listingsBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    expect(listingsBuilder.eq).toHaveBeenCalledWith('seller_id', seller.id);
  });

  it('throws when the update errors (e.g. the engaged-listing guard rejects it)', async () => {
    const listingsBuilder = makeQueryBuilder({
      data: null,
      error: new Error('listing_edit_requires_review'),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      ListingRepository.updateListing('l1', seller.id, { title: 'New title' }),
    ).rejects.toThrow('listing_edit_requires_review');
  });
});

describe('ListingRepository.isEngaged', () => {
  it('calls the is_listing_engaged RPC with the listing id', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await ListingRepository.isEngaged('l1');

    expect(mockRpc).toHaveBeenCalledWith('is_listing_engaged', { p_listing_id: 'l1' });
    expect(result).toBe(true);
  });

  it('throws when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(ListingRepository.isEngaged('l1')).rejects.toThrow('network down');
  });
});

describe('ListingRepository.deleteListing', () => {
  it('hard-deletes scoped to the owner', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingRepository.deleteListing('l1', seller.id);

    expect(listingsBuilder.delete).toHaveBeenCalled();
    expect(listingsBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    expect(listingsBuilder.eq).toHaveBeenCalledWith('seller_id', seller.id);
  });

  it('throws when the delete errors', async () => {
    const listingsBuilder = makeQueryBuilder({ data: null, error: new Error('delete failed') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') return listingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingRepository.deleteListing('l1', seller.id)).rejects.toThrow('delete failed');
  });
});
