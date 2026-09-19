// supabase-js sets no timeout on anything, and neither does fetch. A request
// that is neither answered nor refused — a captive portal, a saturated access
// point in a lecture hall, a backend slow to accept connections — holds its
// spinner for about a minute on iOS and indefinitely on Android. This wraps
// fetch so every Supabase request (database, auth, storage) gives up instead.

// Above the server's own 8s statement timeout, so when the database is the slow
// part its error arrives first and says why.
export const REQUEST_TIMEOUT_MS = 15_000
// Photos over campus cellular are legitimately slow.
export const UPLOAD_TIMEOUT_MS = 120_000

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

// Object writes only. Signing, listing and metadata calls live under the same
// path and are ordinary short requests.
function isUpload(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return false
  return /\/storage\/v1\/object\/(?!sign\/|list\/|info\/)/.test(url)
}

export function createFetchWithTimeout(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const timeoutMs = isUpload(urlOf(input), method) ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS

    // AbortSignal.timeout() and AbortSignal.any() do not exist in Hermes, so the
    // caller's signal (React Query cancelling a superseded request) is chained
    // onto the timeout's controller by hand.
    const controller = new AbortController()
    const callerSignal = init?.signal
    const abort = () => controller.abort()
    if (callerSignal?.aborted) abort()
    else callerSignal?.addEventListener('abort', abort)

    const timer = setTimeout(abort, timeoutMs)
    try {
      return await baseFetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', abort)
    }
  }
}
