import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

// What Axis must not ship in a crash report, and how it gets stripped.
//
// The App Store privacy label and the in-app privacy policy both say crash
// data is not linked to identity and never contains messages or listings. The
// Sentry SDK's default breadcrumbs work against that: every fetch and XHR the
// app makes is recorded with its full URL, and Supabase puts the interesting
// parts of a query in the query string — user ids in filters
// (`seller_id=eq.<uuid>`, `id=in.(…)`) and search text in `title.ilike.*…*`.
//
// Kept separate from sentry.ts, with type-only imports, so it can be tested
// without loading the native SDK.

/**
 * Scheme, host and path only. That still says which endpoint failed, which is
 * what a crash report needs; the query string and fragment are where the data
 * lives.
 */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

/**
 * Drops console breadcrumbs outright — they carry whatever was logged near the
 * failure — and removes query strings from any breadcrumb that records a URL.
 * Recent SDKs also split the query into its own `http.query` /
 * `http.fragment` fields, so those go too.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null
  if (!breadcrumb.data) return breadcrumb

  const data: Record<string, unknown> = { ...breadcrumb.data }
  if (typeof data.url === 'string') data.url = stripQuery(data.url)
  delete data['http.query']
  delete data['http.fragment']

  return { ...breadcrumb, data }
}

/**
 * The last check before an event leaves the device. Breadcrumbs are scrubbed
 * again here because the React Native SDK merges in breadcrumbs recorded by
 * the native iOS/Android SDKs, which never pass through `beforeBreadcrumb`.
 * A request URL on the event (native HTTP-client errors set one) gets the same
 * treatment, and its query string, cookies and headers are removed.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event }

  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is Breadcrumb => b !== null)
  }

  if (event.request) {
    const { query_string: _query, cookies: _cookies, headers: _headers, ...request } = event.request
    scrubbed.request = {
      ...request,
      ...(typeof request.url === 'string' ? { url: stripQuery(request.url) } : {}),
    }
  }

  return scrubbed
}
