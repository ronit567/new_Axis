import { supabase } from './supabase'

// Milestone 5 smoke test. Requires the `health_check` table
// (see supabase/health_check.sql) and valid keys in `.env`.
// Call from a dev button or the RN debugger, e.g.:
//   import { runHealthCheck } from './src/lib/healthCheck'
//   runHealthCheck().then(console.log)

export type HealthCheckResult = {
  ok: boolean
  url: string | undefined
  inserted: boolean
  rowCount: number
  error?: string
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL

  try {
    const { error: insertError } = await supabase
      .from('health_check')
      .insert({})
    if (insertError) {
      return { ok: false, url, inserted: false, rowCount: 0, error: insertError.message }
    }

    const { data, error: selectError } = await supabase
      .from('health_check')
      .select('*')
    if (selectError) {
      return { ok: false, url, inserted: true, rowCount: 0, error: selectError.message }
    }

    return { ok: true, url, inserted: true, rowCount: data?.length ?? 0 }
  } catch (e) {
    return {
      ok: false,
      url,
      inserted: false,
      rowCount: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
