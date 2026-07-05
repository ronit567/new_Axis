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
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    in: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    insert: jest.fn(() => builder),
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
    ilike: (...args: any[]) => { record('ilike', args); return builder; },
    or: (...args: any[]) => { record('or', args); return builder; },
    in: (...args: any[]) => { record('in', args); return builder; },
    lte: (...args: any[]) => { record('lte', args); return builder; },
    order: (...args: any[]) => { record('order', args); return builder; },
    limit: (...args: any[]) => { record('limit', args); return builder; },
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

  it('always scopes to active listings, newest first, capped to the page limit', async () => {
    await ListingRepository.search('', {});
    expect(searchListingsBuilder.calls.eq).toEqual([['status', 'active']]);
    expect(searchListingsBuilder.calls.order).toEqual([['created_at', { ascending: false }]]);
    expect(searchListingsBuilder.calls.limit).toEqual([[50]]);
    expect(searchListingsBuilder.calls.or).toBeUndefined();
    expect(searchListingsBuilder.calls.in).toBeUndefined();
    expect(searchListingsBuilder.calls.lte).toBeUndefined();
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
    const results = await ListingRepository.search('nonexistent', {});
    expect(results).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('listings');
  });

  it('maps matching rows into domain Listings with an accurate count', async () => {
    searchListingsResult = {
      data: [makeSearchRow({ id: 'l1' }), makeSearchRow({ id: 'l2', title: 'Calc textbook' })],
      error: null,
    };
    const results = await ListingRepository.search('textbook', {});
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(['l1', 'l2']);
    expect(results[0].seller.id).toBe('s1');
  });

  it('defaults saved to false when no current user is given', async () => {
    searchListingsResult = { data: [makeSearchRow({ id: 'l1' })], error: null };
    const [result] = await ListingRepository.search('', {});
    expect(result.saved).toBe(false);
    expect(mockFrom).not.toHaveBeenCalledWith('saved_listings');
  });

  it('folds in the current user\'s saved-ids scoped to the result set', async () => {
    searchListingsResult = {
      data: [makeSearchRow({ id: 'l1' }), makeSearchRow({ id: 'l2' })],
      error: null,
    };
    searchSavedResult = { data: [{ listing_id: 'l1' }], error: null };

    const results = await ListingRepository.search('', {}, 'u1');

    expect(results.find((r) => r.id === 'l1')?.saved).toBe(true);
    expect(results.find((r) => r.id === 'l2')?.saved).toBe(false);
    expect(searchSavedBuilder.calls.eq).toEqual([['user_id', 'u1']]);
    expect(searchSavedBuilder.calls.in).toEqual([['listing_id', ['l1', 'l2']]]);
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
