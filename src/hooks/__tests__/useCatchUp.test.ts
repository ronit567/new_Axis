// scheduleCatchUp: after a realtime gap, everything realtime feeds is asked for
// once, however many signals report the gap.

jest.mock('../../lib/supabase', () => ({ supabase: {} }));

import { QueryClient } from '@tanstack/react-query';
import { scheduleCatchUp } from '../useCatchUp';

describe('scheduleCatchUp', () => {
  let client: QueryClient;
  let invalidate: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    client.clear();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('invalidates the inbox, every thread, the notification list and the bell', () => {
    scheduleCatchUp(client, 'me');
    jest.advanceTimersByTime(600);

    expect(invalidate.mock.calls.map(([arg]) => arg.queryKey)).toEqual([
      ['conversations', 'me'],
      ['messages'],
      ['notifications', 'me'],
      ['unreadNotificationCount', 'me'],
    ]);
  });

  it('is one catch-up when both channels re-join and the app foregrounds together', () => {
    scheduleCatchUp(client, 'me'); // messages channel re-joined
    scheduleCatchUp(client, 'me'); // notifications channel re-joined
    scheduleCatchUp(client, 'me'); // AppState went active
    jest.advanceTimersByTime(600);

    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it('spreads clients out so a Realtime restart is not a synchronised wave', () => {
    (Math.random as jest.Mock).mockReturnValue(1);
    scheduleCatchUp(client, 'me');

    jest.advanceTimersByTime(600);
    expect(invalidate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(invalidate).toHaveBeenCalledTimes(4);
  });
});
