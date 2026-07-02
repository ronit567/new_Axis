import React from 'react'
import {
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

// On any 401, flush the session and cache so a stale/expired token can't leave
// the app in a half-authenticated state or leak data across sign-ins.
const queryCache = new QueryCache({
  onError: (error) => {
    if (isUnauthorized(error)) {
      void supabase.auth.signOut()
      queryClient.clear()
    }
  },
})

const queryClient = new QueryClient({
  queryCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

// Export so AuthContext can call queryClient.clear() on signOut
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
