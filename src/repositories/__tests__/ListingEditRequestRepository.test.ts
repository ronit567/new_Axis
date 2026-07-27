// ListingEditRequestRepository tests (0021): create's undefined -> null
// mapping and getPending's query chain + row mapping, same makeQueryBuilder
// mock style as ListingRepository.test.ts.

import type { ListingEditRequestRow } from '../../types/database';

type QueryResult<T> = { data: T | null; error: unknown };

function makeQueryBuilder<T>(result: QueryResult<T>) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
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

import { ListingEditRequestRepository } from '../ListingEditRequestRepository';

function makeRow(overrides: Partial<ListingEditRequestRow> = {}): ListingEditRequestRow {
  return {
    id: 'ler1',
    listing_id: 'l1',
    requester_id: 'seller-1',
    proposed_title: 'New title',
    proposed_category: null,
    proposed_condition: null,
    proposed_image_urls: null,
    proposed_thumb_urls: null,
    status: 'pending',
    created_at: '2026-07-01T10:00:00.000Z',
    reviewed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('ListingEditRequestRepository.create', () => {
  it('inserts the proposed fields, mapping an omitted field to null', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listing_edit_requests') return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingEditRequestRepository.create('seller-1', 'l1', { title: 'New title' });

    expect(builder.insert).toHaveBeenCalledWith({
      listing_id: 'l1',
      requester_id: 'seller-1',
      proposed_title: 'New title',
      proposed_category: null,
      proposed_condition: null,
      proposed_image_urls: null,
      proposed_thumb_urls: null,
    });
  });

  it('passes through a full proposed set, including imageUrls and thumbUrls', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listing_edit_requests') return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await ListingEditRequestRepository.create('seller-1', 'l1', {
      title: 'New title',
      category: 'Electronics',
      condition: 'Good',
      imageUrls: ['https://cdn.test/a.jpg'],
      thumbUrls: ['https://cdn.test/a_thumb.jpg'],
    });

    expect(builder.insert).toHaveBeenCalledWith({
      listing_id: 'l1',
      requester_id: 'seller-1',
      proposed_title: 'New title',
      proposed_category: 'Electronics',
      proposed_condition: 'Good',
      proposed_image_urls: ['https://cdn.test/a.jpg'],
      proposed_thumb_urls: ['https://cdn.test/a_thumb.jpg'],
    });
  });

  it('throws when the insert errors', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('insert failed') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listing_edit_requests') return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      ListingEditRequestRepository.create('seller-1', 'l1', { title: 'New title' }),
    ).rejects.toThrow('insert failed');
  });
});

describe('ListingEditRequestRepository.getPending', () => {
  it('queries the pending request scoped to listing + requester, newest first', async () => {
    const row = makeRow();
    const builder = makeQueryBuilder({ data: row, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listing_edit_requests') return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingEditRequestRepository.getPending('l1', 'seller-1');

    expect(builder.eq).toHaveBeenCalledWith('listing_id', 'l1');
    expect(builder.eq).toHaveBeenCalledWith('requester_id', 'seller-1');
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual({
      id: 'ler1',
      listingId: 'l1',
      status: 'pending',
      proposedTitle: 'New title',
      proposedCategory: null,
      proposedCondition: null,
      proposedImageUrls: null,
      createdAt: '2026-07-01T10:00:00.000Z',
    });
  });

  it('returns null when there is no pending request', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listing_edit_requests') return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await ListingEditRequestRepository.getPending('l1', 'seller-1');

    expect(result).toBeNull();
  });

  it('throws when the query errors', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('network down') });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'listing_edit_requests') return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(ListingEditRequestRepository.getPending('l1', 'seller-1')).rejects.toThrow(
      'network down',
    );
  });
});
