import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { queryClient } from '../providers/QueryProvider';
import ActivitySpinner from '../components/ActivitySpinner';
import { COLORS } from '../constants/theme';

/**
 * Outcome of a sign-up attempt, so the caller can route correctly instead of
 * blindly navigating to the verify screen:
 * - `verify`    — new account created; a confirmation code was sent, go verify.
 * - `signed-in` — the project auto-confirms emails, so a session already exists
 *                 and the navigator swaps to the app on its own (no navigation).
 * - `exists`    — the email is already registered; Supabase returns an
 *                 obfuscated user with no identities and sends no code.
 */
export type SignUpResult = 'verify' | 'signed-in' | 'exists';

type AuthContextValue = {
  /** Single source of truth for which experience to show — derives from the session. */
  isSignedIn: boolean;
  session: Session | null;
  user: User | null;
  /** True while the persisted session is being restored on launch. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always resolve `loading`, even if session restore rejects (e.g. a
    // corrupted keychain/keystore entry) — otherwise the provider is stuck
    // rendering the spinner forever and the app never mounts.
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isSignedIn: !!session,
      session,
      user: session?.user ?? null,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Auto-confirm projects return a live session; onAuthStateChange will
        // swap the navigator, so the caller must not navigate to VerifyEmail.
        if (data.session) return 'signed-in';
        // Anti-enumeration: an already-registered email comes back with a user
        // whose identities array is empty and no confirmation email is sent.
        if (data.user && data.user.identities?.length === 0) return 'exists';
        return 'verify';
      },
      verifyOtp: async (email, token) => {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'signup',
        });
        if (error) throw error;
      },
      // Clear the query cache on the way out so the next user on this device
      // can't briefly see the previous user's cached data.
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [session, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <ActivitySpinner size="large" style={styles.loading} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
