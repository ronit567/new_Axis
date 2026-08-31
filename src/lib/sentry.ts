import * as Sentry from '@sentry/react-native'

// The DSN is not a secret (it only authorises *writes* to the project), but it
// is environment-specific, so it comes from the env like the Supabase vars.
// EXPO_PUBLIC_* is inlined at bundle time — see .env.example.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

// Missing DSN is a valid state, not an error: a contributor who hasn't set one
// still gets a working app, and the crash path stays exercised (the boundary
// renders, captureError just no-ops). Guarding on __DEV__ as well keeps the
// noise of hot-reload errors out of the production issue stream.
const enabled = Boolean(dsn) && !__DEV__

export function initCrashReporting(): void {
  if (!enabled) return

  Sentry.init({
    dsn,

    // PRIVACY (Guideline 5.1.1): Axis sends crash diagnostics only, never
    // anything identifying. sendDefaultPii would attach the user's IP address
    // and request headers; we never call Sentry.setUser(), so an event carries
    // a stack trace and device model and nothing that ties it to a student.
    // This is what lets the App Store privacy label declare Diagnostics as
    // "not linked to identity" — if that changes, the label has to change too.
    sendDefaultPii: false,

    // Breadcrumbs are the useful half of a crash report and the risky half for
    // privacy: console breadcrumbs would capture whatever was logged near the
    // failure. The app logs nothing in production, but this makes it structural
    // rather than a property of today's code.
    enableCaptureFailedRequests: false,
    maxBreadcrumbs: 30,

    // No performance tracing. It samples every navigation and network call for
    // data we have no use for yet, and each sampled transaction is another
    // payload to reason about under 5.1.
    tracesSampleRate: 0,
  })
}

/**
 * Report a caught error. Safe to call whether or not reporting is configured —
 * callers should never have to know.
 *
 * `context` is free-form and must stay non-identifying: screen names, query
 * keys, and error codes are fine; emails, listing bodies, and message text are
 * not.
 */
export function captureError(
  error: unknown,
  context?: Record<string, string | number | boolean>,
): void {
  if (!enabled) return

  Sentry.captureException(error, context ? { extra: context } : undefined)
}
