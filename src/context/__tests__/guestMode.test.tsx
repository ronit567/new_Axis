// Guest mode in AuthProvider (Guideline 5.1.1(v)). What these pin:
//   * "Browse without an account" makes the app browsable with no session;
//   * a guest who signs in arrives with an empty query cache — guest reads
//     (no sellers, nothing saved) share keys with the signed-in screens, so a
//     leftover page would render as if it were the user's own feed;
//   * signing in ends guest mode, so a later sign-out lands on Welcome;
//   * an ordinary signed-in session event never clears the cache.

import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

type AuthCallback = (event: string, session: unknown) => void;
let mockAuthCallback: AuthCallback | null = null;

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: (cb: AuthCallback) => {
        mockAuthCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  },
}));

import { AuthProvider, useAuth } from '../AuthContext';
import { queryClient } from '../../providers/QueryProvider';

function Probe() {
  const { isGuest, isSignedIn, canBrowse, loading, browseAsGuest } = useAuth();
  return (
    <>
      <Text testID="state">
        {JSON.stringify({ isGuest, isSignedIn, canBrowse, loading })}
      </Text>
      <Pressable onPress={browseAsGuest} accessibilityRole="button">
        <Text>browse</Text>
      </Pressable>
    </>
  );
}

const state = () => JSON.parse(String(screen.getByTestId('state').props.children));
const session = { access_token: 't', user: { id: 'u1' } };

async function renderProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(state().loading).toBe(false));
}

let clearSpy: jest.SpyInstance;

beforeEach(() => {
  mockAuthCallback = null;
  clearSpy = jest.spyOn(queryClient, 'clear').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('guest mode', () => {
  it('starts signed out and not browsing, so the navigator shows Welcome', async () => {
    await renderProvider();
    expect(state()).toMatchObject({ isGuest: false, isSignedIn: false, canBrowse: false });
  });

  it('lets a signed-out user browse after "Browse without an account"', async () => {
    await renderProvider();
    fireEvent.press(screen.getByText('browse'));
    expect(state()).toMatchObject({ isGuest: true, isSignedIn: false, canBrowse: true });
  });

  it('clears the cache and ends guest mode when the guest signs in', async () => {
    await renderProvider();
    fireEvent.press(screen.getByText('browse'));

    act(() => mockAuthCallback?.('SIGNED_IN', session));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ isGuest: false, isSignedIn: true, canBrowse: true });
  });

  it('returns to Welcome, not guest browsing, after that user signs out', async () => {
    await renderProvider();
    fireEvent.press(screen.getByText('browse'));
    act(() => mockAuthCallback?.('SIGNED_IN', session));

    act(() => mockAuthCallback?.('SIGNED_OUT', null));

    expect(state()).toMatchObject({ isGuest: false, isSignedIn: false, canBrowse: false });
  });

  it('never clears the cache for a session event that did not come from a guest', async () => {
    await renderProvider();

    act(() => mockAuthCallback?.('SIGNED_IN', session));
    act(() => mockAuthCallback?.('TOKEN_REFRESHED', session));

    expect(clearSpy).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ isGuest: false, isSignedIn: true });
  });
});
