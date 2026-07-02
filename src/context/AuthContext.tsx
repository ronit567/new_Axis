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

type AuthContextValue = {
  /** Single source of truth for which experience to show — derives from the session. */
  isSignedIn: boolean;
  session: Session | null;
  user: User | null;
  /** True while the persisted session is being restored on launch. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

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
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
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
