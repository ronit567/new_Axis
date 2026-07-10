// FollowRepository (migration 0019): asserts query shape + the RLS-hidden
// profile drop via the mocked `supabase.from(...)` thenable-chain builder,
// same approach as ListingRepository.test.ts.

import type { FollowRow, ProfileRow } from '../../types/database';

type QueryResult = { data?: unknown; count?: number | null; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    in: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
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

import { FollowRepository } from '../FollowRepository';

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
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
    ...overrides,
  };
}

function makeFollowRow(overrides: Partial<FollowRow> = {}): FollowRow {
  return {
    follower_id: 'me',
    followee_id: 'seller-1',
    created_at: '2026-07-01T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('FollowRepository.listFollowing', () => {
  function mockQueries(opts: {
    follows: QueryResult;
    profiles?: QueryResult;
  }) {
    const followsBuilder = makeQueryBuilder(opts.follows);
    const profilesBuilder = makeQueryBuilder(opts.profiles ?? { data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'follows') return followsBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    return { followsBuilder, profilesBuilder };
  }

  it('queries own follows newest-first and maps followee profiles', async () => {
    const { followsBuilder } = mockQueries({
      follows: { data: [makeFollowRow()], error: null },
      profiles: { data: [makeProfileRow()], error: null },
    });

    const result = await FollowRepository.listFollowing('me');

    expect(followsBuilder.eq).toHaveBeenCalledWith('follower_id', 'me');
    expect(followsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'seller-1', name: 'Aria K.', verified: true });
  });

  it('drops follows whose profile is RLS-hidden instead of rendering blanks', async () => {
    mockQueries({
      follows: {
        data: [
          makeFollowRow({ followee_id: 'seller-1' }),
          makeFollowRow({ followee_id: 'blocked-user' }),
        ],
        error: null,
      },
      profiles: { data: [makeProfileRow()], error: null },
    });

    const result = await FollowRepository.listFollowing('me');

    expect(result.map((p) => p.id)).toEqual(['seller-1']);
  });

  it('skips the profiles fetch entirely when following no one', async () => {
    mockQueries({ follows: { data: [], error: null } });

    const result = await FollowRepository.listFollowing('me');

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });

  it('propagates a follows query error', async () => {
    mockQueries({ follows: { data: null, error: new Error('boom') } });

    await expect(FollowRepository.listFollowing('me')).rejects.toThrow('boom');
  });
});

describe('FollowRepository.isFollowing', () => {
  it('is true when a row exists for (follower, followee)', async () => {
    const builder = makeQueryBuilder({ count: 1, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(FollowRepository.isFollowing('me', 'seller-1')).resolves.toBe(true);
    expect(builder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(builder.eq).toHaveBeenCalledWith('follower_id', 'me');
    expect(builder.eq).toHaveBeenCalledWith('followee_id', 'seller-1');
  });

  it('is false on a zero (or null) count', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ count: null, error: null }));

    await expect(FollowRepository.isFollowing('me', 'seller-1')).resolves.toBe(false);
  });
});

describe('FollowRepository.follow / unfollow', () => {
  it('follow upserts idempotently on the (follower, followee) pair', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await FollowRepository.follow('me', 'seller-1');

    expect(builder.upsert).toHaveBeenCalledWith(
      { follower_id: 'me', followee_id: 'seller-1' },
      { onConflict: 'follower_id,followee_id', ignoreDuplicates: true },
    );
  });

  it('unfollow deletes exactly the (follower, followee) row', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await FollowRepository.unfollow('me', 'seller-1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('follower_id', 'me');
    expect(builder.eq).toHaveBeenCalledWith('followee_id', 'seller-1');
  });
});
