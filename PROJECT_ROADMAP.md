# Axis — Project Roadmap & Ticket Backlog

> Author: planning pass by Claude, 2026-07-02
> Scope: everything from "Phase 1 code is done, blocked on Supabase keys" → a shippable v1 student marketplace.
> Companion to `AI_context.md` (the session protocol / architecture bible). This file is the **what to build next and in what order**; `AI_context.md` is the **how we work**.

---

## How to read this document

- **Epics** group related work. **Tickets** (`AX-###`) are the unit of a branch + PR.
- Each ticket has: **Why**, **Tasks**, **Acceptance criteria (AC)**, **Depends on**, **Size** (S ≤ half day, M ≤ 2 days, L ≤ 4 days, XL = break it down).
- Ticket IDs are stable — reference them in branch names (`feature/AX-101-apply-schema`) and commits.
- Respect the hard rules already in `AI_context.md`: no Supabase in screens/components, no `any`, no direct mock imports once a screen is migrated, RLS never disabled, one branch per unit.

### Status legend
- ⬜ Not started
- 🟨 Partially done (code exists, unverified or unwired)
- ✅ Done
- 🔒 Blocked (dependency or user action)

---

## Where the codebase actually is (2026-07-02 audit)

I read the tree, not just the context doc. Reality:

| Layer | State | Evidence |
|---|---|---|
| Frontend UI (24 screens, components, theme) | ✅ Complete, ships on mock data | `src/screens/*`, `src/data/mockListings.ts` |
| Supabase client singleton | 🟨 Code done, unverified | `src/lib/supabase.ts` — needs `.env` keys |
| TanStack Query provider | ✅ Wired in `App.tsx` | `src/providers/QueryProvider.tsx` |
| Real AuthContext | 🟨 Code done, unverified end-to-end | `src/context/AuthContext.tsx` |
| Repository layer | 🟨 **Placeholders only** — return `[]`/`null`, mutations `throw` | `src/repositories/*` |
| Hooks layer | 🟨 Written, **not imported by any screen** | `src/hooks/*` |
| DB schema + RLS | 🟨 **Drafted, not applied** to a project | `supabase/migrations/000{1,2}_*.sql` |
| Image upload (Storage) | ⬜ Not started | `CreateListingScreen` holds local URIs |
| Realtime messaging | ⬜ Not started | `MessagesScreen`/`ChatScreen` fully static |
| Notifications | ⬜ Table drafted, no generation strategy | `NotificationsScreen` static |
| Tests / CI | ⬜ **None exist** | no test runner, no `.github/` |

### Screens still on mock/static data (the migration surface)
Confirmed by `grep`:
- `HomeScreen` — `LISTINGS`, local `savedIds` state, fake 1.2s `setTimeout`
- `SavedScreen` — `SAVED_LISTINGS`
- `SearchScreen` — mock
- `ListingDetailScreen` — mock + hardcoded `SELLER_ARIA`
- `SellerProfileScreen` — mock
- `ProfileScreen` — mock seller + `MY_LISTINGS`
- `ManageListingsScreen` — `MY_LISTINGS`
- `MessagesScreen`, `ChatScreen`, `NotificationsScreen` — entirely static

### The single biggest hidden risk: the type ↔ DB mismatch
`src/types/index.ts` `Listing` was designed for a UI, not a database:

| UI type (`Listing`) | DB reality (`listings` table) | Gap |
|---|---|---|
| `seller: Seller` (nested object) | `seller_id: uuid` | needs a **join + mapper** |
| `postedAgo: '3d ago'` (string) | `created_at: timestamptz` | derive at read time |
| `imageColor: '#E8E0F5'` | `image_urls: text[]` | placeholder → real images |
| `saved: boolean` (on the row) | `saved_listings` join table | per-user, computed |
| `views: number` | `views` column | fine |
| — | `is_free`, `is_trade`, `status` | not on the UI type yet |

**Nothing works until there is a mapper** (`toListing(row, seller, savedIds)`) sitting inside the repository. This is the keystone ticket (**AX-110**). Every screen-migration ticket depends on it. Do not skip it or scatter mapping logic across screens.

---

## Epic 0 — Unblock Phase 1 (finish the foundation)

**Goal:** get from "code compiles" to "one real row round-trips from a simulator." This is Milestone 5 in `AI_context.md`, currently 🔒 on the user.

### AX-001 — Provision Supabase project & load keys 🔒 (user)
**Why:** everything downstream is blocked; the client can't init without a URL + anon key.
**Tasks:**
- Create Supabase project `axis` (region close to London, ON).
- Copy Project URL + anon key into `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never commit; never use `service_role` in-app.
- Confirm `.env` gitignored (already is).
**AC:** `console.log(supabase.supabaseUrl)` prints the real URL in dev.
**Depends on:** nothing. **Size:** S (user action).

### AX-002 — Smoke test the round-trip (Milestone 5) 🔒
**Why:** proves client + auth + query wiring works before building on it.
**Tasks:**
- Create the throwaway `health_check` table (`supabase/health_check.sql`).
- Call `runHealthCheck()` (`src/lib/healthCheck.ts`) from a temporary dev button.
- Verify: insert succeeds, select returns rows, session restores on relaunch with no auth flash, both signed-in/out states render.
- Drop `health_check` after.
**AC:** all 8 checklist items in `AI_context.md` Milestone 5 pass on a simulator.
**Depends on:** AX-001. **Size:** S.

### AX-003 — Verify the real auth flow end-to-end ⬜
**Why:** `AuthContext` was written but never run against a live project. Email OTP templates, session persistence, and the loading gate are all unverified.
**Tasks:**
- Configure Supabase Auth: enable email signups, set the OTP/confirmation email template, set redirect (not used on native but set it).
- Walk `CreateAccount → VerifyEmail (OTP) → signed in`. Confirm `SignIn` and `signOut` (Settings) work.
- Confirm no auth flash on cold start; `ActivitySpinner` shows during restore.
- Confirm `queryClient.clear()` fires on sign-out (no data leak between accounts).
**AC:** sign up, verify, sign in, sign out all work on a device; session survives an app kill.
**Depends on:** AX-001. **Size:** M.

---

## Epic 1 — Database & data-access foundation (Phase 2 core)

This epic is the load-bearing wall. Screens come after.

### AX-101 — Apply schema & RLS to the live project ⬜
**Why:** the drafts in `supabase/migrations/` have never been run. Everything real needs the tables.
**Tasks:**
- Decide migration workflow: Supabase CLI (`supabase link` + `supabase db push`) vs. paste-in-dashboard. **Recommend the CLI** so migrations stay version-controlled and reproducible.
- Apply `0001_initial_schema.sql` then `0002_rls_policies.sql`.
- Verify RLS is ON for all 5 tables and the default-deny + owner-write policies behave (test with two accounts).
- Add a `updated_at` trigger to `profiles`/`listings` if we want edit tracking (decide now — cheap to add, annoying to backfill).
**AC:** all tables exist with RLS; an authenticated user can read listings/profiles, can only write their own rows; a second user cannot mutate the first's data.
**Depends on:** AX-001. **Size:** M.
**Open decisions (resolve in the PR):**
- **Category as free text vs. enum/CHECK.** Schema deliberately left `category` unconstrained. Now that `src/constants/categories.ts` is the source of truth, add a CHECK constraint or a `categories` lookup table so bad data can't land. Recommend CHECK against `LISTING_CATEGORIES`.
- **`profiles` auto-creation.** Add a `handle_new_user()` trigger on `auth.users` that inserts a bare `profiles` row? Or create it from the app in the onboarding step? See AX-301.

### AX-102 — Generate DB types & establish the DB-type boundary ⬜
**Why:** hand-writing row shapes drifts from the schema. Generate them.
**Tasks:**
- `npx supabase gen types typescript --project-id <id> > src/types/database.ts`.
- Add an npm script `db:types` so regeneration is one command.
- Decide the boundary: repositories speak **DB row types** internally, return **domain types** (`Listing`, `SellerProfile`) outward. Screens never see row types.
**AC:** `src/types/database.ts` exists and is imported only by repositories/mappers; `db:types` script works.
**Depends on:** AX-101. **Size:** S.

### AX-110 — Mapper layer: DB rows → domain types ⭐ KEYSTONE ✅
> **Done** on `feature/phase2-foundation` (`2eaf2fd`). `src/lib/timeAgo.ts`, `src/types/database.ts` (hand-authored rows, to be replaced by AX-102 gen-types), `src/repositories/mappers.ts` (`toSeller`/`toListing`/`toSellerProfile`), + 18 unit tests. Decisions logged in-code: deterministic `imageColor`/`avatarColor` fallbacks, `dotColor` defaults to muted grey (no presence system), `badge` always null (no column), rating/reviewCount 0 until AX-702.
**Why:** the type↔DB mismatch above. Without a single mapping point, every screen reinvents `created_at → "3d ago"` and seller joins. This is where that lives.
**Tasks:**
- Create `src/repositories/mappers.ts` (or per-repo `mapListing`, `mapProfile`).
- `toListing(row, sellerRow, isSaved)` → `Listing`, including:
  - `postedAgo` from `created_at` (add a `timeAgo()` util — also usable elsewhere).
  - `imageColor` fallback when `image_urls` is empty (keep skeleton behaviour).
  - `saved` from the caller's saved-id set.
  - nested `seller: Seller` from the joined profile row.
- `toSellerProfile(row, stats)` → `SellerProfile` (rating/reviewCount are 0 until reviews exist — see AX-702).
- Unit-test the mappers (first use of the test harness from AX-901).
**AC:** given a fixture row, mappers produce a valid domain object; `timeAgo` handles seconds→weeks; empty image array yields a stable color.
**Depends on:** AX-102, ideally AX-901. **Size:** M. **Blocks:** AX-201, AX-202, AX-203, AX-30x.

### AX-111 — Implement `ListingRepository` for real ⬜
**Why:** it's all placeholders (`return []`, `throw`).
**Tasks:**
- `getAll(category?)` — select listings + joined seller profile, filter `status='active'`, optional category, order by `created_at desc`; map via AX-110. Fold in the current user's saved-ids so `saved` is correct.
- `getById(id)` — single listing + seller.
- `create(input)` — insert with `seller_id = auth uid`; return mapped `Listing`. (Image upload handled in AX-401 — `create` takes already-uploaded `image_urls`.)
- `toggleSaved(listingId, userId)` — insert/delete on `saved_listings`.
- `getSavedByUser(userId)` — join saved → listings → seller.
- Add `incrementViews(id)` (RPC or update) — wire in AX-203.
- Define a real error shape so the QueryProvider 401 handler (`AI_context.md` M2 note) can stop guessing.
**AC:** each method hits the DB and returns typed domain data; RLS respected; save/unsave persists; creating a listing appears in `getAll`.
**Depends on:** AX-110. **Size:** L.

### AX-112 — Implement `ProfileRepository` for real ✅
**Tasks:** `getById`, `getCurrent` (join uid), `upsert(userId, input)` insert-or-update own row. Map via AX-110.
**AC:** current user's profile loads; upsert persists and is visible to a second account (public read).
**Depends on:** AX-110. **Size:** M.
**Done (AX-301):** `stats` (listings/sold) is zeroed pending AX-111's real listing counts, same deferral pattern as `rating`/`reviewCount` pending AX-702.

### AX-113 — Implement `MessageRepository` for real ⬜
**Tasks:**
- `getConversations(userId)` — distinct counterparties with last message + unread count (needs a `read`/`read_at` column — **schema change**, add in this ticket).
- `getMessages(listingId, otherUserId)` — thread between the two users for a listing, ordered.
- `send(senderId, input)` — insert; return mapped message.
- Note: conversation identity is `(listing, otherUser)`, not just `listing`. Current `queryKeys.messages(listingId)` and `getMessages(listingId)` are **too coarse** — revise the key + signature here.
**AC:** two accounts can exchange messages tied to a listing; conversation list shows the latest line.
**Depends on:** AX-110. **Size:** L. (Realtime is AX-501 — this ticket is fetch/send only.)

---

## Epic 2 — Wire the browse & listing surface (kill the mock)

Each ticket replaces a mock import with a hook and deletes the fake loading. **Do not delete `src/data/mockListings.ts` until the last consumer is migrated** (tracked as AX-299).

### AX-201 — HomeScreen on real data ⬜
**Why:** flagship screen; currently `LISTINGS` + local `savedIds` + `setTimeout(1200)`.
**Tasks:**
- Replace `LISTINGS`/filter with `useListings(activeCategory)`.
- Delete the fake `setTimeout` loading; drive skeleton off `isLoading`/`isPending`, error state off `isError`, `EmptyState` off empty data. (The skeleton/error/empty components already exist — just rewire the conditions.)
- Replace local `savedIds` with `useToggleSaved` (optimistic update so the heart is instant).
- Pull the greeting name/avatar/location from `useCurrentProfile` instead of the hardcoded "Ronit / RS".
**AC:** Home renders live listings, category filter hits the DB, save toggles persist and survive relaunch, no artificial delay.
**Depends on:** AX-111, AX-112. **Size:** M.

### AX-202 — SavedScreen on real data ⬜
**Tasks:** `useSavedListings`; remove the fake loading; empty state when nothing saved; unsave updates both Saved and Home caches (invalidation already in `useToggleSaved`).
**AC:** saved items reflect DB; unsaving removes them live.
**Depends on:** AX-111. **Size:** S.

### AX-203 — ListingDetailScreen on real data + views ⬜
**Why:** uses hardcoded `SELLER_ARIA`; nav currently passes the whole `Listing` object.
**Tasks:**
- Switch nav param from full object → `{ listingId }` and fetch with `useListing(id)` (fresh data, smaller params). Update `RootStackParamList` + all `navigate('ListingDetail', …)` callers (7 sites, per grep).
- Seller block from the listing's joined profile; "message seller" wired in AX-502.
- Call `incrementViews` once per view (guard against the owner inflating their own count).
**AC:** detail shows live listing + real seller; view count increments for non-owners.
**Depends on:** AX-111, AX-112. **Size:** M.
**Note:** the param-shape change is a small refactor but touches Home, Saved, Profile, SellerProfile, Chat. Do it here, once.

### AX-204 — SearchScreen on real data ⬜
**Tasks:** server-side search (title ilike, category/price filters). Add `ListingRepository.search(query, filters)`. Debounce input. Reuse skeleton/empty states.
**AC:** typing returns matching live listings; filters apply.
**Depends on:** AX-111. **Size:** M.

### AX-205 — SellerProfileScreen on real data ⬜
**Tasks:** nav param → `{ sellerId }`; `useProfile(sellerId)` + that seller's active listings. Remove mock.
**AC:** any seller's public profile + their listings load live.
**Depends on:** AX-111, AX-112. **Size:** S.

### AX-299 — Delete `mockListings.ts` & assert no mock imports ⬜
**Why:** the file is a landmine once data is live (double sources of truth).
**Tasks:** confirm zero imports (`grep -r mockListings src`), delete the file, keep `SELLER_ARIA`/color fallbacks only if something legitimately needs them (move to a constants file if so). Add a lint rule / CI grep that fails if `data/mockListings` is imported.
**AC:** file deleted; `tsc` + app run clean; CI guards against reintroduction.
**Depends on:** AX-201, AX-202, AX-203, AX-204, AX-205, AX-301, AX-303, AX-304. **Size:** S.

---

## Epic 3 — Selling, profile & onboarding

### AX-301 — Onboarding / first-run profile capture ✅
**Why:** documented gap in `AI_context.md`. `verifyOtp` creates a session immediately, so the signed-out `SetupProfile` step is **bypassed** and `handleFinish` is a no-op. New users currently land with no `profiles` row.
**Decision:** gated on profile existence, not session — client-side upsert from `SetupProfile`, no `handle_new_user()` DB trigger. `RootNavigator` now has 3 groups (signed-out / needs-onboarding / main); a signed-in user with no `profiles` row is routed to a mandatory `SetupProfile` before the tabs, gated via `useCurrentProfile`.
**Tasks:**
- `SetupProfile` → `useUpsertProfile` (name, program, year, bio; location/avatar color/initials deferred — no UI for them yet, DB defaults + mapper fallbacks cover it).
- `verified` revived: set from the same `@uwo.ca`/`@alumni.uwo.ca` check `CreateAccountScreen` already uses (`src/lib/email.ts`), computed at SetupProfile submit time.
- `profiles.bio` column added (migration 0003) — wasn't in the original schema.
- Full name typed at `CreateAccountScreen` now rides through as signup metadata (`user_metadata.full_name`) so `SetupProfile` can prefill it instead of asking again.
**AC:** a brand-new account is forced through profile setup exactly once; returning users skip it; a `profiles` row always exists before the marketplace loads.
**Depends on:** AX-112, AX-003. **Size:** M. **This unblocks AX-201's greeting and all seller displays.**

### AX-302 — CreateListing submit (the real thing) ⬜
**Why:** `handlePost` currently just `navigation.goBack()` — nothing is saved.
**Tasks:**
- Wire `useCreateListing`; build `CreateListingInput` from form state (title, description, price/is_free/is_trade, condition, category, pickup).
- Block submit until images upload (AX-401) resolves to `image_urls`.
- Loading state on the Post button; error surfaced (not a silent goBack); on success invalidate listings and navigate to the new detail (or Home).
- Validate: title required, price required unless free/trade (logic exists in `canPost` — extend for trade).
**AC:** posting creates a real listing visible on Home and in Manage Listings.
**Depends on:** AX-111, AX-401. **Size:** M.

### AX-303 — ProfileScreen on real data ⬜
**Tasks:** `useCurrentProfile` + current user's listings; remove mock seller + `MY_LISTINGS`. Stats (listings/sold) computed from real listings.
**AC:** own profile + own listings live.
**Depends on:** AX-111, AX-112. **Size:** S.

### AX-304 — ManageListingsScreen on real data + edit/delete/mark-sold ⬜
**Why:** `MY_LISTINGS` mock; also the CRUD verbs don't exist yet.
**Tasks:**
- List the current user's listings (active + sold) from `ListingRepository`.
- Add `updateListing`, `markSold`, `deleteListing` to the repo + hooks.
- Wire the manage actions (edit → prefilled CreateListing in edit mode, mark sold, delete with confirm).
**AC:** user can edit, mark sold, and delete their own listings; changes reflect on Home.
**Depends on:** AX-111. **Size:** L.

### AX-305 — EditProfileScreen wired ⬜
**Tasks:** load current profile, save via `useUpsertProfile`, optimistic update.
**AC:** profile edits persist and show immediately.
**Depends on:** AX-112. **Size:** S.

---

## Epic 4 — Images (Supabase Storage)

### AX-401 — Image upload pipeline ⬜
**Why:** `CreateListingScreen` collects local URIs; nothing uploads. `image_urls` would be dead local paths.
**Tasks:**
- Create a `listing-images` Storage bucket; RLS/storage policy: authenticated users upload to their own prefix (`{uid}/...`), public read.
- Add `StorageRepository.uploadListingImages(localUris)` → public URLs (compress/resize first — RN images are large; use `expo-image-manipulator`).
- Handle upload progress + failure + partial-upload cleanup.
- Feed resulting URLs into `CreateListingInput.image_urls` (AX-302).
**AC:** picking photos uploads them; the listing shows real images; a failed upload doesn't create a broken listing.
**Depends on:** AX-101. **Size:** L. **Blocks:** AX-302 completion.

### AX-402 — Render real listing images (cards + detail) ⬜
**Why:** `ListingCard` and detail currently use `imageColor` placeholders.
**Tasks:** show `image_urls[0]` on cards, gallery/carousel on detail; keep `imageColor` as the loading/empty fallback; add caching (`expo-image` recommended over RN `Image` for perf).
**AC:** listings display uploaded photos with a graceful fallback.
**Depends on:** AX-401. **Size:** M.

### AX-403 — Avatar images ⬜
**Tasks:** optional profile photo upload; keep initials+color as fallback (already the design). Storage `avatars` bucket.
**AC:** users can set an avatar; fallback intact.
**Depends on:** AX-401, AX-112. **Size:** M.

---

## Epic 5 — Messaging (Realtime)

### AX-501 — Realtime message subscription ⬜
**Why:** `MessagesScreen`/`ChatScreen` are fully static.
**Tasks:** Supabase Realtime on `messages` filtered to the current user; push new rows into the `messages` query cache; enable Realtime on the table in the dashboard.
**AC:** a message from account B appears in account A's open chat without a manual refresh.
**Depends on:** AX-113. **Size:** L.

### AX-502 — ChatScreen + MessagesScreen wired ⬜
**Tasks:**
- `MessagesScreen` ← `useConversations`; `ChatScreen` ← `useMessages` + `useSendMessage` (optimistic append).
- Nav params → IDs (`{ listingId, otherUserId }`) not full objects; update the "message seller" entry points in ListingDetail/SellerProfile.
- Empty/loading/error states.
**AC:** real conversation list; sending persists and appears instantly; reopening shows history.
**Depends on:** AX-113, AX-501. **Size:** L.

### AX-503 — Unread badges & read receipts ⬜
**Tasks:** mark-read on open; unread count on the Messages tab + conversation rows (needs the `read` column from AX-113).
**AC:** unread count is accurate and clears on read.
**Depends on:** AX-113, AX-502. **Size:** M.

---

## Epic 6 — Notifications

### AX-601 — Notification generation strategy ⬜ (decision)
**Why:** table is drafted but nothing writes to it; RLS insert policy is a placeholder (owner-only, which is wrong for system-generated notifications).
**Tasks:** decide the source — **DB triggers** (on new message, on save of your listing) via `security definer` functions, vs. Edge Functions. Fix the RLS insert policy accordingly. Define notification `type` enum.
**AC:** a documented, working path that creates a notification row when someone messages you / saves your listing.
**Depends on:** AX-113. **Size:** M.

### AX-602 — NotificationsScreen wired + in-app badge ⬜
**Tasks:** `useNotifications` (list + unread count), mark-read, tap → deep link to the relevant listing/chat; wire the Home bell dot to real unread count.
**AC:** notifications reflect real events; badge accurate; taps navigate correctly.
**Depends on:** AX-601. **Size:** M.

### AX-603 — Push notifications (optional, v1.1) ⬜
**Tasks:** `expo-notifications`, store push tokens on `profiles`, send from the trigger/Edge Function.
**AC:** background push on new message.
**Depends on:** AX-601. **Size:** L. **Priority:** post-v1.

---

## Epic 7 — Trust, safety & product polish (student-marketplace specific)

### AX-701 — Restrict signups to the university domain ⬜
**Why:** it's a *Western students* marketplace. Right now any email can sign up. This is core to the product's trust model.
**Decision (2026-07-02, confirmed):** allow **`@uwo.ca` only**. This one rule covers main-campus and the affiliate colleges (Huron/King's/Brescia students are issued `@uwo.ca` addresses), so there is no separate affiliate-domain list to maintain.
**Tasks:**
- Client-side check at `CreateAccount` (reject non-`@uwo.ca` before calling `signUp`, with a clear inline error).
- Real gate server-side: a Supabase Auth hook / `before user created` trigger that rejects any email not ending in `@uwo.ca` — the client check is UX only and must not be the enforcement point.
- Normalize case (`.trim().toLowerCase()`) before the check.
**AC:** a non-`@uwo.ca` email is rejected at sign-up both in the UI and at the backend even if the client check is bypassed.
**Depends on:** AX-003. **Size:** M.

### AX-702 — Reviews & ratings ⬜
**Why:** `SellerProfile` shows `rating`/`reviewCount` but there's no `reviews` table — it's fabricated data.
**Tasks:** `reviews` table (reviewer, seller, listing, stars, text) + RLS; leave-review flow after a sale; compute seller rating; feed AX-110's `toSellerProfile`.
**AC:** real ratings on seller profiles; until built, **hide the rating UI** rather than show fake stars.
**Depends on:** AX-112. **Size:** L. **Near-term:** the "hide fake stars" half is a 30-min ticket — do it before launch even if reviews slip.

### AX-703 — Report & block are functional ⬜
**Why:** `ReportModal` UI exists (COMP-01) but likely isn't persisted.
**Tasks:** `reports` table + `blocks` table; wire the existing modal; filter blocked users out of feeds/messages.
**AC:** reporting persists; blocking hides the user's content and messages.
**Depends on:** AX-101. **Size:** M.

### AX-704 — Account deletion actually deletes ⬜
**Why:** there's a `feature/t6-account-deletion` branch — verify it does a real deletion (auth user + cascade), not just a sign-out.
**Tasks:** Edge Function or RPC to delete the auth user; rely on `on delete cascade` (already in schema) for owned rows; confirmation flow.
**AC:** deleting an account removes the user and their listings/messages.
**Depends on:** AX-101. **Size:** M.

### AX-705 — VerifyEmail resend wired ⬜
**Why:** `AI_context.md` Known Issues — the resend button is UI-only (just resets a countdown).
**Tasks:** wire to `supabase.auth.resend({ type: 'signup', email })`; rate-limit UI.
**AC:** resend actually sends a new code.
**Depends on:** AX-003. **Size:** S.

### AX-706 — Legal pages content review ⬜
**Why:** Privacy/Terms/Community screens exist (`t7-legal-pages`) — confirm real content, not lorem.
**Tasks:** review copy with the user; ensure links from Settings work.
**AC:** legal pages have accurate, final copy.
**Depends on:** none. **Size:** S.

---

## Epic 8 — Quality, tooling & release

### AX-901 — Test harness ✅
> **Done** on `feature/phase2-foundation` (`a0a0c8a`). `jest-expo` preset, `jest.config.js` (ignores `.claude/worktrees` to avoid Haste collisions), `npm test`/`test:watch`. 20 tests green across mappers/timeAgo/sanity.
**Why:** zero tests today. The mapper and repositories are exactly the logic worth testing.
**Tasks:** add Jest + `@testing-library/react-native` + `ts-jest`/babel-jest; a sample mapper test; `npm test` script. Consider MSW or a Supabase mock for repo tests.
**AC:** `npm test` runs; mapper tests pass.
**Depends on:** none. **Size:** M. **Sequencing:** land before/with AX-110.

### AX-902 — CI pipeline ✅
> **Done** on `feature/phase2-foundation` (`91fdb4e`, refined `5198c53`). `scripts/check-architecture.sh` (fatal on Supabase-in-screens, warns on mock imports until AX-299), `npm run check:arch`, `.github/workflows/ci.yml` (tsc + arch + `test --if-present`). Guard matches real import lines only, not comments.
**Tasks:** GitHub Actions: `tsc --noEmit`, `npm test`, and a grep-guard that fails on `data/mockListings` imports (post AX-299) and on direct `lib/supabase` imports in `screens/`/`components/` (enforces the architecture rule automatically).
**AC:** PRs run typecheck + tests + the architecture guards.
**Depends on:** AX-901. **Size:** S.

### AX-903 — Error tracking & logging ⬜
**Tasks:** Sentry (or similar) for crashes; a thin logger; surface the QueryProvider 401 path (define the real error shape referenced in AX-111).
**AC:** runtime errors are captured off-device.
**Depends on:** AX-111. **Size:** M.

### AX-904 — Env & release config ⬜
**Tasks:** EAS build profiles (dev/preview/prod); separate Supabase dev vs. prod projects; document the `.env` matrix; confirm bundle IDs (`com.axis.app`).
**AC:** reproducible dev and prod builds against the right backend.
**Depends on:** AX-001. **Size:** M.

### AX-905 — Performance pass on the feed ⬜
**Tasks:** `FlatList` tuning (`getItemLayout`, `windowSize`), image caching (`expo-image`), pagination/infinite scroll on `getAll` (offset/cursor) — the current design fetches everything.
**AC:** feed scrolls smoothly with 100+ listings; images don't jank.
**Depends on:** AX-201, AX-402. **Size:** M.

---

## Suggested execution order (dependency-aware)

**Sprint 0 — Unblock (mostly user):** AX-001 → AX-002 → AX-003. In parallel (no backend needed): AX-901, AX-706, the "hide fake stars" slice of AX-702.

**Sprint 1 — Foundation:** AX-101 → AX-102 → **AX-110 (keystone)** → AX-111, AX-112. Then AX-301 (onboarding) so every screen has a real profile to read.

**Sprint 2 — Browse works:** AX-201, AX-202, AX-203, AX-205, then AX-204. Land AX-401 + AX-402 (images) alongside. Then AX-302 (create listing) and AX-303/304/305 (profile + manage).

**Sprint 3 — Kill the mock:** AX-299 (delete mock, add CI guard AX-902).

**Sprint 4 — Messaging:** AX-113 → AX-501 → AX-502 → AX-503.

**Sprint 5 — Notifications + safety:** AX-601/602, AX-701, AX-703, AX-704, AX-705.

**Sprint 6 — Harden & ship:** AX-903, AX-904, AX-905, then AX-603/702 as v1.1.

---

## Open questions for the user (blockers on specific tickets)

1. ~~**Allowed email domains (AX-701):**~~ **RESOLVED 2026-07-02** — `@uwo.ca` only. Affiliate-college students (Huron/King's/Brescia) get `@uwo.ca` addresses, so this single rule covers them; no separate domain list.
2. **Category storage (AX-101):** CHECK constraint against `LISTING_CATEGORIES`, or a lookup table for future admin-editable categories?
3. ~~**Profile creation (AX-301):**~~ **RESOLVED 2026-07-04** — app creates it in onboarding, gated on profile existence (no DB trigger).
4. **Reviews at launch (AX-702):** ship v1 with reviews, or hide the rating UI and add reviews in v1.1?
5. **Notification generation (AX-601):** DB triggers vs. Edge Functions — any preference / existing infra?
6. **Migration workflow (AX-101):** adopt the Supabase CLI (recommended, version-controlled) or manage schema in the dashboard?

---

## Notes on process debt worth fixing

- **Stacked branches:** the Phase-1 work is a chain of un-merged feature branches (`supabase-client → query-provider → auth-provider → repository-layer → hooks-layer`). Before Phase 2, decide whether to merge that chain into `main` (recommended — get a clean base) so new tickets branch off `main`, not off each other.
- **`AI_context.md` "Remaining Work" list is stale** — it re-lists Milestones 3/4 as remaining even though the Handoff marks them complete. Reconcile it during the next `Update context` pass.
- **Nav params carry full objects** (`Listing`, `SellerProfile`). Migrating to IDs (AX-203, AX-502) is the right call for data freshness and smaller navigation state — do it as part of those tickets, not as a big-bang refactor.
