// ReviewRepository (migration 0020): list mapping + the select-then-
// update/insert upsert split (forced by the column-restricted UPDATE grant —
// see the migration). Mocked `supabase.from(...)` builder, same approach as
// ListingRepository.test.ts.

import type { ProfileRow, ReviewRow } from '../../types/database';

type QueryResult = { data?: unknown; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    in: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: QueryResult) => unknown) => resolve(result),
  };
  return builder;
}

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { ReviewRepository } from '../ReviewRepository';

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'reviewer-1',
    name: 'Liam P.',
    initials: 'LP',
    program: 'Engineering',
    year: 3,
    location: 'Saugeen',
    bio: null,
    avatar_url: null,
    avatar_color: '#7B4BB0',
    verified: true,
    reply_time: null,
    created_at: '2024-09-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeReviewRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: 'r1',
    seller_id: 'seller-1',
    reviewer_id: 'reviewer-1',
    rating: 5,
    body: 'Smooth pickup, exactly as described.',
    created_at: '2026-07-01T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('ReviewRepository.listForSeller', () => {
  function mockQueries(opts: { reviews: QueryResult; profiles?: QueryResult }) {
    const reviewsBuilder = makeQueryBuilder(opts.reviews);
    const profilesBuilder = makeQueryBuilder(opts.profiles ?? { data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'reviews') return reviewsBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    return { reviewsBuilder, profilesBuilder };
  }

  it('queries a seller newest-first and maps reviewer display info', async () => {
    const { reviewsBuilder } = mockQueries({
      reviews: { data: [makeReviewRow()], error: null },
      profiles: { data: [makeProfileRow()], error: null },
    });

    const result = await ReviewRepository.listForSeller('seller-1');

    expect(reviewsBuilder.eq).toHaveBeenCalledWith('seller_id', 'seller-1');
    expect(reviewsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'r1',
      sellerId: 'seller-1',
      rating: 5,
      body: 'Smooth pickup, exactly as described.',
      reviewer: { id: 'reviewer-1', name: 'Liam P.', initials: 'LP' },
    });
  });

  it('drops reviews whose reviewer profile is RLS-hidden', async () => {
    mockQueries({
      reviews: {
        data: [makeReviewRow(), makeReviewRow({ id: 'r2', reviewer_id: 'blocked-user' })],
        error: null,
      },
      profiles: { data: [makeProfileRow()], error: null },
    });

    const result = await ReviewRepository.listForSeller('seller-1');

    expect(result.map((r) => r.id)).toEqual(['r1']);
  });

  it('skips the profiles fetch when the seller has no reviews', async () => {
    mockQueries({ reviews: { data: [], error: null } });

    const result = await ReviewRepository.listForSeller('seller-1');

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });
});

describe('ReviewRepository.upsertOwn', () => {
  const input = { sellerId: 'seller-1', rating: 4, body: 'Quick replies.' };

  it('updates only (rating, body) when the caller already reviewed this seller', async () => {
    const builder = makeQueryBuilder({ data: { id: 'r1' }, error: null });
    mockFrom.mockReturnValue(builder);

    await ReviewRepository.upsertOwn('me', input);

    expect(builder.update).toHaveBeenCalledWith({ rating: 4, body: 'Quick replies.' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('inserts a fresh review when none exists yet', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await ReviewRepository.upsertOwn('me', input);

    expect(builder.insert).toHaveBeenCalledWith({
      seller_id: 'seller-1',
      reviewer_id: 'me',
      rating: 4,
      body: 'Quick replies.',
    });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('propagates an error (e.g. the RLS chat-gate rejection) to the caller', async () => {
    const builder = makeQueryBuilder({
      data: null,
      error: new Error('new row violates row-level security policy'),
    });
    mockFrom.mockReturnValue(builder);

    await expect(ReviewRepository.upsertOwn('me', input)).rejects.toThrow(
      /row-level security/,
    );
  });
});
