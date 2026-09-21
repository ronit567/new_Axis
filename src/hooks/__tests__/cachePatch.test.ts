// patchQueriesKeepingAge: an optimistic patch must be invisible to freshness.
// Pure QueryClient, no React — what matters is the cache's bookkeeping.

import { QueryClient } from '@tanstack/react-query';
import { patchQueriesKeepingAge } from '../cachePatch';

const STALE_TIME = 2 * 60 * 1000;

// gcTime Infinity schedules no garbage-collection timer, so nothing outlives the
// test and holds the Jest process open.
const clients: QueryClient[] = [];
function newClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: STALE_TIME, gcTime: Infinity } },
  });
  clients.push(client);
  return client;
}
afterEach(() => {
  while (clients.length) clients.pop()?.clear();
});

function clientWith(entries: Array<[readonly unknown[], unknown, number]>) {
  const client = newClient();
  for (const [key, data, updatedAt] of entries) {
    client.setQueryData(key, data, { updatedAt });
  }
  return client;
}

describe('patchQueriesKeepingAge', () => {
  it('patches every cache under the prefix and leaves its fetch time alone', () => {
    const fetchedAt = Date.now() - 90_000;
    const client = clientWith([
      [['listings', 'all'], [{ id: 'a', saved: false }], fetchedAt],
      [['listings', 'Textbooks'], [{ id: 'a', saved: false }], fetchedAt - 5_000],
      [['search', 'calc', {}], [{ id: 'b', saved: false }], fetchedAt],
    ]);

    patchQueriesKeepingAge<Array<{ id: string; saved: boolean }>>(
      client,
      { queryKey: ['listings'] },
      (old) => old?.map((item) => (item.id === 'a' ? { ...item, saved: true } : item)),
    );

    expect(client.getQueryData(['listings', 'all'])).toEqual([{ id: 'a', saved: true }]);
    expect(client.getQueryData(['listings', 'Textbooks'])).toEqual([{ id: 'a', saved: true }]);
    expect(client.getQueryState(['listings', 'all'])?.dataUpdatedAt).toBe(fetchedAt);
    expect(client.getQueryState(['listings', 'Textbooks'])?.dataUpdatedAt).toBe(fetchedAt - 5_000);
    // A different prefix is not touched.
    expect(client.getQueryData(['search', 'calc', {}])).toEqual([{ id: 'b', saved: false }]);
  });

  it('does not make a stale cache look fresh, which plain setQueryData does', () => {
    const longAgo = Date.now() - STALE_TIME - 1_000;
    const flip = (old?: { saved: boolean }) => (old ? { ...old, saved: true } : old);

    const kept = clientWith([[['listing', 'x'], { saved: false }, longAgo]]);
    patchQueriesKeepingAge<{ saved: boolean }>(kept, { queryKey: ['listing', 'x'] }, flip);
    expect(kept.getQueryCache().find({ queryKey: ['listing', 'x'] })?.isStaleByTime(STALE_TIME)).toBe(true);

    // The behaviour this helper exists to avoid.
    const reset = clientWith([[['listing', 'x'], { saved: false }, longAgo]]);
    reset.setQueryData<{ saved: boolean }>(['listing', 'x'], flip);
    expect(reset.getQueryCache().find({ queryKey: ['listing', 'x'] })?.isStaleByTime(STALE_TIME)).toBe(false);
  });

  it('leaves a query that has no data yet untouched', () => {
    const client = newClient();
    client.getQueryCache().build(client, { queryKey: ['listing', 'never-fetched'] });

    patchQueriesKeepingAge<{ saved: boolean }>(client, { queryKey: ['listing'] }, (old) =>
      old ? { ...old, saved: true } : old,
    );

    expect(client.getQueryData(['listing', 'never-fetched'])).toBeUndefined();
  });
});
