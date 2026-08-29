import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signOut } from '../providers/QueryProvider';

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
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  resend: (email: string) => Promise<void>;
  /** Emails a recovery code. Silent on unknown addresses — see below. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Redeems a recovery code. On success the user is SIGNED IN. */
  verifyPasswordResetOtp: (email: string, token: string) => Promise<void>;
  /** Sets a new password for the currently signed-in user. */
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Auth actions close only over module singletons (supabase, and — for
// signOut, imported above — queryClient), so they're defined once at module
// scope rather than rebuilt on every render.

async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(
  email: string,
  password: string,
  fullName?: string,
): Promise<SignUpResult> {
  // full_name rides in as user metadata so SetupProfile can prefill the name
  // it needs to write `profiles.name` — otherwise the name typed here would
  // be lost by the time the onboarding gate reaches SetupProfile.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
  if (error) throw error;
  // Auto-confirm projects return a live session; onAuthStateChange will swap
  // the navigator, so the caller must not navigate to VerifyEmail.
  if (data.session) return 'signed-in';
  // Anti-enumeration: an already-registered email comes back with a user whose
  // identities array is empty and no confirmation email is sent.
  if (data.user && data.user.identities?.length === 0) return 'exists';
  return 'verify';
}

async function verifyOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) throw error;
}

async function resend(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// Sends a recovery email. Supabase deliberately does NOT error on an unknown
// address (anti-enumeration: erroring would let anyone probe which emails have
// accounts), so a resolved promise means "sent if that account exists" — never
// "that account exists". The UI must not claim an email was definitely sent.
async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// type: 'recovery' — the signup OTP type would reject a recovery token. A
// successful call establishes a session, which is what authorises the
// updatePassword() that must follow it.
async function verifyPasswordResetOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) throw error;
}

async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// The offline-safe signOut (global call with a local-only fallback, then a
// query-cache clear) is defined in QueryProvider — it owns queryClient, and
// its 401 handler needs to call this exact function too, so a 401 while
// offline gets the same guarantee-cleared treatment as an explicit sign-out.
// Re-exported here as part of the public auth API.
export { signOut };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always resolve `loading`, even if session restore rejects (e.g. a
    // corrupted keychain/keystore entry) — otherwise the app never leaves the
    // loading state.
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
      signIn,
      signUp,
      verifyOtp,
      resend,
      requestPasswordReset,
      verifyPasswordResetOtp,
      updatePassword,
      signOut,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
