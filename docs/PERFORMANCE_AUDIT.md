# Performance audit: what stops Axis running smoothly at 1,000+ users

20 September 2026. Companion to the `perf/scale-readiness` pull request.

## How to read this

**The target.** "1,000 users" means nothing until it is a load, so every finding
was judged against this one: 1,000–5,000 registered students at one university,
100–300 active at once at peak (start of term, evenings), about 10,000 listings
(2,000 active), 200,000 messages, and a power user with 100+ conversations and
200+ listings, on mid-range and older iPhones over campus wifi and cellular.

**What was measured and what was not.** Production holds one listing and
seventeen messages, so nothing can be measured there. Findings are reasoned from
query shapes and code. The one database change that could be tested was tested
against a real local Postgres (see "Verified by execution").

**How far to trust it.** Seven independent reviewers each audited one layer and
produced 51 findings. A second pass was meant to try to refute every one of
them; it did not run (the account hit its usage limit). So: everything under
"Fixed" was re-verified by hand against the code before it was changed, and each
entry says how. Everything under "Not fixed" is a finding nobody has tried to
disprove yet. Treat those as leads, not facts.

## Needs you: things no code change fixes

1. **Apply migrations `0048` and `0049`.** They are in this branch and are not
   applied to production. Nothing in the app depends on them, so merging first
   is safe. The daily drift check will report them as pending until they are in.
   Confirm the API's exposed schemas are still `public` and `graphql_public`
   (Dashboard → API): `0048` keeps a function in a `private` schema so that it
   stays off the API surface.
2. **Review hosting capacity and rate-limit settings before launch.** The audit
   found settings on the hosting side that matter more at this scale than
   anything in the diff. This repository is public, so those notes are
   deliberately not in it; they were handed to the maintainer directly.

## Fixed in this pull request

| Problem | Change | How it was verified |
| --- | --- | --- |
| One chat message cost about 18 requests across the two people: the inbox (a view over every message the user has exchanged, plus two hydration queries) was rebuilt on every send, receive, read receipt and echoed UPDATE, and each send refetched the whole thread. | The inbox row is patched in place when that is exact; one debounced rebuild otherwise (new partner, different listing, a read made elsewhere). Unread is cleared before the request so its own echoes are no-ops. A superseded rebuild is aborted. | Read every invalidation site. `inboxPatch.test.ts`: exactness rules, idempotence, a 30-event burst is one rebuild, a steady stream still refreshes. |
| Inbox and notification hydration selected full rows: for 100 conversations, roughly 300 KB per rebuild where about 15 KB is used. | Five profile columns and four listing columns. | Mapper inputs narrowed to match, so the compiler enforces it. |
| A heart tap refetched every loaded page of every mounted feed and search (two requests per page), after an optimistic patch that was already correct. | No refetch. Patches keep each cache's fetch time, so a tap neither restarts the staleness clock nor needs an invalidation. | `cachePatch.test.ts`, including the contrast case showing plain `setQueryData` makes a stale cache look fresh. |
| Creating, selling, relisting, deleting or editing a listing refetched the whole feed and every search. | Only the user's own manage list, storefront and the listing itself. | Both queries filter `.neq('seller_id', userId)`: a user's own listing cannot appear in their own feed or search. |
| Mark-all-read with K unread cost 4 + 4K requests. | No refetch after an exact optimistic update; echoes of this device's own reads are recognised and ignored; real bursts share one invalidation. | Read the mutation and echo paths. |
| Messages that arrived while the app was backgrounded, or across a wifi-to-cellular handoff, were silently missing until a manual refresh. Realtime has no replay, focus refetching is off, and those queries stay mounted all session. | Both channels report a re-join; returning from 15 s or more in the background counts too. Either triggers one jittered invalidation of what realtime feeds: four light reads, not a global focus refetch. | `realtimeStatus.test.ts`, `useCatchUp.test.ts`. |
| A failing read could become twelve requests over about 24 s: `postgrest-js` retries a GET three times itself, and React Query retried every error twice more, including ones that cannot succeed twice. | Retry only errors that may not recur, once, with jitter. | Confirmed the built-in retries in the installed `postgrest-js` source. `retryPolicy.test.ts`. |
| No request had a timeout: a stalled one held its spinner for about a minute on iOS and indefinitely on Android. | 15 s for every Supabase request, 120 s for photo uploads. A re-sent message keeps its id, and a duplicate-key error on it is read as "it did arrive", so a timeout after the insert committed cannot post a message twice. | `fetchWithTimeout.test.ts`, including caller cancellation and upload-path matching. |
| Every avatar was re-downloaded on each cold start and each hour: the signed URL, with its fresh token, was the disk-cache key. | Keyed by storage path, which is unique per upload. | Confirmed in `expo-image`'s types that the uri is the key unless one is given. |
| Avatars were uploaded at whatever size the picker produced, up to the 2 MB bucket cap, for a circle drawn at 84 pt at most. | Resized to 512 px JPEG, like listing photos. | Repository tests. |
| `React.memo` on `ListingCard` never held: each screen passed a closure per card and depended on the whole `useMutation` result. With two columns `FlatList` cannot protect rows either, so a keystroke, a scroll or a heart tap re-rendered every mounted card. | Cards receive their item in shared, stable handlers; storefront rows memoized; the tab badge subscribes to a selected count; the banner context value is stable. | A test that counts the card's real renders: zero with shared handlers, more than zero with the old pattern. |
| A logged-in user could land on Welcome at launch when the token refresh failed on a bad connection, and would often sign in again for no reason. | The restore is retried briefly, bounded by count and by time. | Confirmed `auth-js` keeps the stored session for retryable errors. `restoreSession.test.ts`. |
| Returning to Home after two minutes refetched every page ever scrolled, in sequence, to repaint a list showing page one. | A stale return refreshes the first page only. | Read `MainScreen`: the tab remounts at the top regardless. |
| Search tore its grid down to skeletons on every debounced keystroke. | Previous results stay until the new ones land. | — |
| The Profile tab mounted an image per listing the user owns, in one commit. | Preview capped at nine, with a pointer to Manage, which is virtualized. | — |
| The visibility policies called `SECURITY DEFINER is_blocked()` for every row a scan touched. RLS runs before a non-leakproof filter like `ILIKE`, so search paid it for every active listing however few matched. | `0048`: the caller's block set is computed once per statement. | See below. |
| Deleting a listing or an account sequentially scanned `notifications` and `follows` once per deleted parent row; five indexes were written on every insert or status flip and never chosen. | `0049`. | Applied twice on a local Postgres; confirmed the composite still serves the seller lookup. |

### Verified by execution

`sh scripts/verify-rls-block-list.sh` installs the pre-`0048` policy on a
throwaway local Postgres, seeds 300 users, 3,000 listings and about 520 blocks
(260 of the 300 users end up with someone hidden from them), records exactly
which listings and profiles each user can see, applies the real migration file
twice, and requires the result to be identical for every user. It is.

Timings on an Apple-silicon laptop, which is much faster than a shared database
instance, so read the ratios and not the milliseconds:

| Query | Before | After |
| --- | --- | --- |
| Search with no matches | 11.0 ms | 2.9 ms |
| Feed at offset 500 | 2.1 ms | 0.1 ms |
| 100 profiles by id (inbox hydration) | 1.3 ms | 0.2 ms |

Production runs Postgres 17 and this ran on 16; the migration uses nothing
version-specific.

## Not fixed

Unverified leads, roughly in the order they would start to hurt.

- **Search cannot use its trigram indexes.** `ILIKE` is not leakproof, so under
  RLS Postgres will not push it into an index scan; every search is a linear
  pass over active listings. After `0048` that is a few milliseconds at 2,000
  rows and grows with the catalogue. The real fix is a search function that
  applies the visibility rules itself, which is a security-sensitive design
  change and deserves its own review. The two GIN indexes are write cost with no
  read benefit until then; they were left in place because removing them is a
  decision about search, not about indexes.
- **No fallback when Realtime is unavailable.** The channels now report their
  status, but nothing polls when a join keeps failing.
- **Chat renders up to 200 messages in a non-inverted list** and scrolls to the
  end on every content-size change; every bubble re-renders per keystroke. Felt
  in long threads. An inverted list is the standard fix and changes the
  screen's scroll behaviour, so it belongs with the UX work.
- **Listing detail mounts every gallery photo at full size** on open, up to
  eight at about 300 KB, when most viewers look at the first.
- **The conversation view reads every message the user is party to** on each
  call. After the fan-out fix it runs far less often; for a user with 10,000
  messages it is still the heaviest read.
- **Offset pagination on a newest-first feed** can duplicate or skip a card when
  listings are posted while someone scrolls, and deep pages cost in proportion
  to the offset. Keyset pagination fixes both.
- **List queries select full rows** where grids show one thumbnail, and the feed
  and detail each make two round trips that one embedded select would cover.
- **Deleting a listing or an account scans every `storage.objects` row in the
  bucket.** About 100,000 rows at the target.
- **The banned-term filter runs one regex per term per string**, and Postgres
  caches a limited number of compiled patterns per backend. Fine at the list's
  current size.
- **Cold start is serial**: fonts, then session, then profile, then the feed,
  then saved ids.
- **`LargeSecureStore` decrypts the session in JavaScript on every request**;
  estimated at a few milliseconds each on older phones.
- **No push notifications.** Outside this audit's scope, but it is why Realtime
  carries all delivery, and the dominant reason a message goes unseen.
- Smaller: listing photos are uploaded without a long `cacheControl`; image
  manipulator bitmaps are never released; the tab bar unmounts a screen when you
  leave it, so Home rebuilds each time.

## Looked at and fine

The reviewers reported 107 things they checked and found already handled. The
ones worth knowing: realtime bindings are filtered server-side, so a message
costs two authorization checks rather than one per connected user; the feed and
search are properly paginated with a first-page-only pull-to-refresh; list
screens use virtualized lists with stable keys; listing photos are resized and
thumbnailed before upload and grids load the thumbnails; avatar signing is
batched into one request per list; message and report inserts are rate-limited
in the database; sign-out clears every cache, offline included.
