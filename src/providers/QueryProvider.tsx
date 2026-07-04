import React from 'react'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

function isUnauthorized(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const status = (error as { status?: number }).status
  const code = (error as { code?: string }).code
  return status === 401 || code === '401' || code === 'PGRST301'
}

// Logging out must ALWAYS clear the on-device session and tokens, even offline.
// The default (global) sign-out revokes the session server-side, but that
// network round-trip fails with no connection — and supabase-js then leaves the
// tokens in storage, stranding the user "signed in". So on a failed global
// sign-out, fall back to a purely-local one (no server call) to guarantee the
// device is cleared. Only a failed *local* clear is surfaced to the caller.
//
// Lives here (not AuthContext) because it needs `queryClient`, and the 401
// handler right below needs to call this exact function too — putting it in
// AuthContext would make this module import back from AuthContext, which
// already imports from here. AuthContext re-exports this as the canonical
// `signOut` for the rest of the app.
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
    if (localError) throw localError
  }
  // Clear the query cache on the way out so the next user on this device can't
  // briefly see the previous user's cached data.
  queryClient.clear()
}

// On any 401 — from a query OR a mutation — flush the session and cache so a
// stale/expired token can't leave the app half-authenticated or leak data
// across sign-ins. Goes through the same offline-safe signOut as the explicit
// sign-out action, so a 401 while offline still clears the device instead of
// silently failing (the raw supabase.auth.signOut() has no local fallback).
// This call site has no UI to surface a failure to (unlike the explicit
// sign-out button), so unlike that caller it swallows a rejection — but still
// clears the query cache even in that last-resort case, matching this
// handler's original unconditional-clear behavior.
function handleAuthError(error: unknown) {
  if (isUnauthorized(error)) {
    void signOut().catch(() => {
      queryClient.clear()
    })
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      // Don't waste retries on an expired token — fail fast so the 401 handler
      // signs the user out immediately instead of after seconds of backoff.
      retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

export { queryClient }

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
