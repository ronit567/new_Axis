// AX-204: ListingRepository.search — server-side text/category/price/condition
// filtering. Supabase's query builder is chainable + thenable, so the mock
// below records every filter call and resolves whatever `result` the test
// configured when the chain is finally awaited.

type QueryResult = { data: any; error: any };

function createBuilder(result: QueryResult) {
  const calls: Record<string, any[][]> = {};
  const record = (name: string, args: any[]) => {
    calls[name] = calls[name] || [];
    calls[name].push(args);
  };
  const builder: any = {
    select: (...args: any[]) => { record('select', args); return builder; },
    eq: (...args: any[]) => { record('eq', args); return builder; },
    ilike: (...args: any[]) => { record('ilike', args); return builder; },
    in: (...args: any[]) => { record('in', args); return builder; },
    lte: (...args: any[]) => { record('lte', args); return builder; },
    order: (...args: any[]) => { record('order', args); return builder; },
    then: (resolve: (r: QueryResult) => unknown) => resolve(result),
    calls,
  };
  return builder;
}

let listingsResult: QueryResult = { data: [], error: null };
let savedResult: QueryResult = { data: [], error: null };
let listingsBuilder: any;
let savedBuilder: any;

const mockFrom = jest.fn((table: string) => {
  if (table === 'listings') {
    listingsBuilder = createBuilder(listingsResult);
    return listingsBuilder;
  }
  if (table === 'saved_listings') {
    savedBuilder = createBuilder(savedResult);
    return savedBuilder;
  }
  throw new Error(`Unexpected table: ${table}`);
});

jest.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { ListingRepository } from '../ListingRepository';

const sellerRow = {
  id: 's1',
  name: 'Aria K.',
  initials: 'AK',
  program: 'BMOS',
  year: 2,
  location: 'Elgin Hall',
  avatar_url: null,
  avatar_color: '#5C2D91',
  verified: true,
  reply_time: '~1h',
  created_at: '2024-09-15T10:00:00.000Z',
};

function makeListingRow(overrides: Partial<Record<string, unknown>> = {}) {
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
    seller: sellerRow,
    ...overrides,
  };
}

beforeEach(() => {
  listingsResult = { data: [], error: null };
  savedResult = { data: [], error: null };
  mockFrom.mockClear();
  listingsBuilder = undefined;
  savedBuilder = undefined;
});

describe('ListingRepository.search', () => {
  it('always scopes to active listings, ordered newest first', async () => {
    await ListingRepository.search('', {});
    expect(listingsBuilder.calls.eq).toEqual([['status', 'active']]);
    expect(listingsBuilder.calls.order).toEqual([['created_at', { ascending: false }]]);
    expect(listingsBuilder.calls.ilike).toBeUndefined();
    expect(listingsBuilder.calls.in).toBeUndefined();
    expect(listingsBuilder.calls.lte).toBeUndefined();
  });

  it('applies a trimmed text filter as an ilike on title', async () => {
    await ListingRepository.search('  chem  ', {});
    expect(listingsBuilder.calls.ilike).toEqual([['title', '%chem%']]);
  });

  it('omits the ilike filter for an empty/whitespace-only query', async () => {
    await ListingRepository.search('   ', {});
    expect(listingsBuilder.calls.ilike).toBeUndefined();
  });

  it('escapes LIKE metacharacters in the search text so they match literally', async () => {
    await ListingRepository.search('50% off_deal\\', {});
    expect(listingsBuilder.calls.ilike).toEqual([['title', '%50\\% off\\_deal\\\\%']]);
  });

  it('applies the category filter via an IN clause', async () => {
    await ListingRepository.search('', { categories: ['Textbooks', 'Electronics'] });
    expect(listingsBuilder.calls.in).toEqual([['category', ['Textbooks', 'Electronics']]]);
  });

  it('applies the price-max filter', async () => {
    await ListingRepository.search('', { priceMax: 50 });
    expect(listingsBuilder.calls.lte).toEqual([['price', 50]]);
  });

  it('applies the condition filter', async () => {
    await ListingRepository.search('', { condition: 'Good' });
    expect(listingsBuilder.calls.eq).toEqual([['status', 'active'], ['condition', 'Good']]);
  });

  it('combines text, category, price-max, and condition filters together', async () => {
    await ListingRepository.search('chem', {
      categories: ['Textbooks'],
      priceMax: 60,
      condition: 'Good',
    });
    expect(listingsBuilder.calls.ilike).toEqual([['title', '%chem%']]);
    expect(listingsBuilder.calls.in).toEqual([['category', ['Textbooks']]]);
    expect(listingsBuilder.calls.lte).toEqual([['price', 60]]);
    expect(listingsBuilder.calls.eq).toEqual([['status', 'active'], ['condition', 'Good']]);
  });

  it('returns an accurate, empty result with no matches (and skips the saved-ids lookup)', async () => {
    listingsResult = { data: [], error: null };
    const results = await ListingRepository.search('nonexistent', {});
    expect(results).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('listings');
  });

  it('maps matching rows into domain Listings with an accurate count', async () => {
    listingsResult = {
      data: [makeListingRow({ id: 'l1' }), makeListingRow({ id: 'l2', title: 'Calc textbook' })],
      error: null,
    };
    const results = await ListingRepository.search('textbook', {});
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(['l1', 'l2']);
    expect(results[0].seller.id).toBe('s1');
  });

  it('defaults saved to false when no current user is given', async () => {
    listingsResult = { data: [makeListingRow({ id: 'l1' })], error: null };
    const [result] = await ListingRepository.search('', {});
    expect(result.saved).toBe(false);
    expect(mockFrom).not.toHaveBeenCalledWith('saved_listings');
  });

  it('folds in the current user\'s saved-ids scoped to the result set', async () => {
    listingsResult = {
      data: [makeListingRow({ id: 'l1' }), makeListingRow({ id: 'l2' })],
      error: null,
    };
    savedResult = { data: [{ listing_id: 'l1' }], error: null };

    const results = await ListingRepository.search('', {}, 'u1');

    expect(results.find((r) => r.id === 'l1')?.saved).toBe(true);
    expect(results.find((r) => r.id === 'l2')?.saved).toBe(false);
    expect(savedBuilder.calls.eq).toEqual([['user_id', 'u1']]);
    expect(savedBuilder.calls.in).toEqual([['listing_id', ['l1', 'l2']]]);
  });

  it('throws when the listings query errors', async () => {
    listingsResult = { data: null, error: new Error('boom') };
    await expect(ListingRepository.search('', {})).rejects.toThrow('boom');
  });

  it('throws when the saved-ids query errors', async () => {
    listingsResult = { data: [makeListingRow({ id: 'l1' })], error: null };
    savedResult = { data: null, error: new Error('saved-ids boom') };
    await expect(ListingRepository.search('', {}, 'u1')).rejects.toThrow('saved-ids boom');
  });
});
