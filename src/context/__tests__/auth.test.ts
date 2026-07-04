// Auth action tests: sign-up result routing and offline-safe sign-out.
//
// The action functions close over the `supabase` and `queryClient` singletons,
// so we mock both modules and assert the observable effects (what supabase call
// was made, whether the cache was cleared).

const mockSignOut = jest.fn();
const mockSignUp = jest.fn();
const mockClear = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

jest.mock('../../providers/QueryProvider', () => ({
  queryClient: { clear: () => mockClear() },
}));

import { signUp, signOut } from '../AuthContext';

beforeEach(() => {
  mockSignOut.mockReset();
  mockSignUp.mockReset();
  mockClear.mockReset();
});

describe('signUp result routing', () => {
  it('returns "signed-in" when the project auto-confirms and a session comes back', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'x' }, user: {} }, error: null });
    await expect(signUp('a@uwo.ca', 'pw')).resolves.toBe('signed-in');
  });

  it('returns "exists" for an already-registered email (empty identities, no session)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: { identities: [] } }, error: null });
    await expect(signUp('a@uwo.ca', 'pw')).resolves.toBe('exists');
  });

  it('returns "verify" for a fresh sign-up awaiting email confirmation', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: { identities: [{ id: '1' }] } }, error: null });
    await expect(signUp('a@uwo.ca', 'pw')).resolves.toBe('verify');
  });

  it('throws when supabase returns an error', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: new Error('boom') });
    await expect(signUp('a@uwo.ca', 'pw')).rejects.toThrow('boom');
  });
});

describe('signOut clears the device and cache', () => {
  it('clears the query cache after a successful global sign-out (no local fallback)', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    await signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith(); // global scope = no args
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('falls back to a local sign-out when the global (server) call fails offline, and still clears the cache', async () => {
    mockSignOut
      .mockResolvedValueOnce({ error: new Error('network request failed') }) // global
      .mockResolvedValueOnce({ error: null }); // local fallback
    await signOut();
    expect(mockSignOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('throws and does NOT clear the cache when even the local clear fails', async () => {
    mockSignOut
      .mockResolvedValueOnce({ error: new Error('network request failed') }) // global
      .mockResolvedValueOnce({ error: new Error('keychain locked') }); // local fallback
    await expect(signOut()).rejects.toThrow('keychain locked');
    expect(mockClear).not.toHaveBeenCalled();
  });
});
