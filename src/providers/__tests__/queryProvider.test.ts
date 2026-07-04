// QueryProvider's 401 handler must go through the same offline-safe signOut
// fallback as an explicit sign-out (see ../QueryProvider.tsx and
// ../../context/AuthContext.tsx), not a raw supabase.auth.signOut() call —
// a raw call has no local fallback, so a 401 while offline would silently
// fail to clear the device and leave the user half-authenticated.
//
// We invoke the query cache's onError directly (it's the handler under test)
// rather than driving a real failing query through react-query, and mock
// supabase to control whether the "network" call succeeds.

const mockSignOut = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

import { queryClient } from '../QueryProvider';

function triggerAuthError(error: unknown) {
  queryClient.getQueryCache().config.onError?.(error as never, {} as never);
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  mockSignOut.mockReset();
  jest.spyOn(queryClient, 'clear').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('401 handler', () => {
  it('ignores non-401 errors', async () => {
    triggerAuthError(new Error('boom'));
    await flushMicrotasks();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(queryClient.clear).not.toHaveBeenCalled();
  });

  it('falls back to a local sign-out on a 401 while offline, and still clears the cache', async () => {
    mockSignOut
      .mockResolvedValueOnce({ error: new Error('network request failed') }) // global
      .mockResolvedValueOnce({ error: null }); // local fallback
    triggerAuthError({ status: 401 });
    await flushMicrotasks();
    expect(mockSignOut).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
  });

  it('still clears the cache as a last resort if both the global and local sign-out fail', async () => {
    mockSignOut
      .mockResolvedValueOnce({ error: new Error('network request failed') }) // global
      .mockResolvedValueOnce({ error: new Error('keychain locked') }); // local fallback
    triggerAuthError({ code: 'PGRST301' });
    await flushMicrotasks();
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
  });
});
