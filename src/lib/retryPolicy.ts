// When React Query should retry a failed read.
//
// postgrest-js already retries a GET three times by itself (network errors,
// 503, 520, with backoff). Retrying every error twice more on top of that made
// one failing query up to twelve requests over ~24 seconds — and it retried
// errors that cannot succeed on a second try. At peak that is the wrong
// reflex: the moment the database is struggling is the moment every client
// multiplies its load.

type ErrorShape = { code?: unknown; status?: unknown; statusCode?: unknown }

// True only when the request may simply not have been answered. A Postgres or
// PostgREST error code (a statement timeout, an RLS denial, a constraint, a
// trigger raising) means the server evaluated the request and said no; asking
// again gets the same answer. postgrest-js reports a failure to reach the
// server with an empty code.
export function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, status, statusCode } = error as ErrorShape
  const http = Number(status ?? statusCode)
  if (Number.isFinite(http) && http > 0) return http >= 500
  if (typeof code === 'string' && code !== '') return false
  return true
}

// One retry, not two: by the time an error reaches React Query, postgrest-js
// has usually spent its own three attempts.
export const MAX_QUERY_RETRIES = 1

// Exponential, capped, and jittered. Without jitter every client that failed
// together retries together, so a brief outage ends in a synchronised wave.
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(1000 * 2 ** attempt, 8000)
  return ceiling * (0.5 + random() * 0.5)
}
