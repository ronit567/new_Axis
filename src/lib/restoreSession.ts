// Restoring a session at launch usually means refreshing it: the access token
// lives an hour, so anyone who has been away longer needs a network round trip
// before they are "signed in" again. When that request fails for a transient
// reason — congested campus wifi, an Auth hiccup at peak — auth-js keeps the
// stored session (it only discards it for a refresh token the server rejects)
// and returns `{ session: null, error }`.
//
// Reading only `session` from that turned a slow network into a sign-out: a
// logged-in user landed on Welcome, and many would sign in again, which is an
// extra password sign-in against Auth's per-IP rate limit at the worst moment.
// So an errored restore is retried briefly before the app accepts "signed out".

type SessionResult<S> = { data: { session: S | null }; error: unknown }

export const RESTORE_RETRY_DELAYS_MS = [1000, 2500]
// Attempts can each run to the request timeout on a black-holed network, so the
// retries are also bounded by wall-clock time, not just by count.
export const RESTORE_BUDGET_MS = 12_000

export async function restoreSession<S>(
  getSession: () => Promise<SessionResult<S>>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => number = Date.now,
): Promise<S | null> {
  const startedAt = now()
  for (let attempt = 0; ; attempt += 1) {
    const { data, error } = await getSession()
    // A session, or a clean "there is none" — either way that is the answer.
    if (data.session || !error) return data.session
    const delay = RESTORE_RETRY_DELAYS_MS[attempt]
    if (delay === undefined || now() - startedAt + delay > RESTORE_BUDGET_MS) return null
    await wait(delay)
  }
}
