import { supabase } from './supabase'

// Milestone 5 smoke test — verifies the Supabase connection and RLS are live.
// Call from a dev button or the RN debugger:
//   import { runHealthCheck } from './src/lib/healthCheck'
//   runHealthCheck().then(console.log)

export type HealthCheckResult = {
  ok: boolean
  url: string | undefined
  tablesReachable: boolean
  error?: string
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL

  try {
    // A select with limit 0 verifies the connection and RLS policies without
    // returning data or requiring a row to exist.
    const { error } = await supabase.from('profiles').select('id').limit(0)
    if (error) {
      return { ok: false, url, tablesReachable: false, error: error.message }
    }
    return { ok: true, url, tablesReachable: true }
  } catch (e) {
    return {
      ok: false,
      url,
      tablesReachable: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
