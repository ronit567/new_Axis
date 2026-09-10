import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Signed-URL resolution for the private `avatars` bucket (0039).
//
// profiles.avatar_url holds an object path, not a URL — a signed URL expires,
// so it can't be persisted. Every avatar render therefore needs a path -> URL
// step, and `Avatar` is the only component that does it (all 12 render sites
// go through it), so this module is the whole of the machinery.
//
// Two things make the naive version unusable, and both are handled here:
//
//   * Volume. The Messages inbox mounts ~20 Avatars in one frame, each with a
//     different path. Signing them one at a time is 20 round trips. Supabase
//     exposes createSignedUrls() (plural), so requests that arrive in the same
//     tick are collected and sent as one call.
//
//   * Repetition. The same person's avatar appears in a conversation row, the
//     chat header, and on their listings. Resolved URLs are cached by path and
//     reused until they are close to expiring.

const AVATARS_BUCKET = 'avatars'

// An hour is long enough that scrolling a list never re-signs, and short enough
// that a leaked URL stops working the same day.
const TTL_SECONDS = 60 * 60

// Re-sign this far before actual expiry, so a URL handed to expo-image is never
// within a few seconds of dying while the image is still decoding.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

type Entry = { url: string; expiresAt: number }

const cache = new Map<string, Entry>()

// Paths waiting for the next flush, and everyone waiting on each of them. A
// path requested twice before the flush resolves is signed once and both
// callers get the same URL.
let pending = new Set<string>()
let waiters = new Map<string, Array<(url: string | null) => void>>()
let flushScheduled = false

function fresh(path: string): string | null {
  const hit = cache.get(path)
  if (!hit) return null
  return hit.expiresAt - Date.now() > REFRESH_MARGIN_MS ? hit.url : null
}

function settle(path: string, url: string | null) {
  const fns = waiters.get(path) ?? []
  waiters.delete(path)
  for (const fn of fns) fn(url)
}

async function flush() {
  flushScheduled = false
  const paths = [...pending]
  pending = new Set()
  if (paths.length === 0) return

  // One call for the whole batch. createSignedUrls resolves per-path: an entry
  // can carry its own `error` while its siblings succeed (a deleted object, a
  // path that was never there), so results are read per-entry rather than
  // treating the call as all-or-nothing.
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUrls(paths, TTL_SECONDS)

  if (error || !data) {
    // Nothing to cache — resolve every waiter as "no photo" so Avatar falls
    // back to initials rather than hanging. A later mount retries.
    for (const path of paths) settle(path, null)
    return
  }

  const expiresAt = Date.now() + TTL_SECONDS * 1000
  const byPath = new Map<string, string>()
  for (const row of data) {
    // `path` echoes the input; signedUrl is absent when that entry errored.
    if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl)
  }

  for (const path of paths) {
    const url = byPath.get(path) ?? null
    if (url) cache.set(path, { url, expiresAt })
    settle(path, url)
  }
}

function resolve(path: string): Promise<string | null> {
  const hit = fresh(path)
  if (hit) return Promise.resolve(hit)

  return new Promise(done => {
    const list = waiters.get(path)
    if (list) {
      list.push(done)
    } else {
      waiters.set(path, [done])
    }
    pending.add(path)

    if (!flushScheduled) {
      flushScheduled = true
      // setTimeout(0) rather than a microtask: it batches across the whole
      // commit, so a FlatList that mounts its rows in separate effects still
      // lands in one request.
      setTimeout(() => {
        void flush()
      }, 0)
    }
  })
}

/**
 * Resolve a stored avatar value for rendering.
 *
 * Accepts what `profiles.avatar_url` actually contains across versions:
 * an object path (post-0039), or `null`. A value that is already an absolute
 * URL is passed straight through — which covers a locally-picked photo's
 * `file://` uri in the EditProfile preview, and any row that somehow still
 * holds a pre-0039 public URL.
 *
 * Returns the cached URL synchronously on a hit, so a re-render of an already
 * resolved avatar never flashes back to initials.
 */
export function useAvatarUrl(value?: string | null): string | null {
  const passthrough = !value || value.includes('://')
  const [url, setUrl] = useState<string | null>(() =>
    passthrough ? (value ?? null) : fresh(value),
  )

  useEffect(() => {
    if (passthrough) {
      setUrl(value ?? null)
      return
    }

    const cached = fresh(value)
    if (cached) {
      setUrl(cached)
      return
    }

    let active = true
    void resolve(value).then(next => {
      if (active) setUrl(next)
    })
    return () => {
      active = false
    }
  }, [value, passthrough])

  return url
}

/**
 * Drop every resolved URL. Called from the same place the query cache is
 * cleared on sign-out, so the next account on this device starts empty rather
 * than holding URLs minted under the previous session.
 */
export function clearAvatarUrlCache(): void {
  cache.clear()
  pending = new Set()
  waiters = new Map()
}
