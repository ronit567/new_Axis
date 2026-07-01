import React, { createContext, useContext, useMemo, useState } from 'react';

type AuthContextValue = {
  /** Single source of truth for which experience to show. */
  isSignedIn: boolean;
  /** Enter the signed-in app. Wire this to a real login call later. */
  signIn: () => void;
  /** Return to the signed-out auth flow. Clear real tokens here later. */
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Frontend-only for now: a single boolean drives the navigator split.
  // Later, replace this with real auth state — e.g. restore a token from
  // secure storage on launch, and have signIn/signOut talk to the backend.
  const [isSignedIn, setIsSignedIn] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      isSignedIn,
      signIn: () => setIsSignedIn(true),
      signOut: () => setIsSignedIn(false),
    }),
    [isSignedIn],
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
