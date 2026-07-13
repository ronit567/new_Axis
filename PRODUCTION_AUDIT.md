# Axis — Production Readiness Audit

**Date:** 2026-07-12 · **Scope:** full app (UI, architecture, backend, release infrastructure)
**Sources:** full read of all screens/components/repositories/migrations, live Supabase project checks (`fznliobjdeeyhictbepl`), Supabase security & performance advisors, Expo native-UI guidelines.

## Verdict

The application architecture is genuinely strong — repository pattern enforced by CI, comprehensive RLS with hardened `SECURITY DEFINER` functions, leak-free realtime lifecycles, encrypted session storage, real pagination on the feed, and strict TypeScript with zero `any`. **The app is not shippable today** for two reasons: (1) the production database is missing 7 migrations, so the follows / reviews / listing-edit features will hard-fail for real users, and (2) there is no release infrastructure at all — no EAS config, no crash reporting, no error boundary, no deep-link scheme, no push notifications. UI needs a polish pass (consistency, accessibility, dead controls) but its foundations are solid.

Legend: **P0** = launch blocker · **P1** = fix before/at launch · **P2** = fast-follow polish · **P3** = post-launch

---

## P0 — Launch blockers: Backend / Database

### 1. Apply the 7 missing migrations to production
**Confirmed live:** the production DB has only 14 of 21 migrations. Missing: `0003_profiles_bio`, `0004_profiles_verified_trigger`, `0014_storage_buckets`, `0018_signup_email_hook`, `0019_follows`, `0020_reviews`, `0021_listing_edit_requests`. The `follows`, `reviews`, and `listing_edit_requests` tables **do not exist in prod**, yet the app ships FollowRepository/ReviewRepository/ListingEditRequestRepository, the follow button, review writing, and the edit-request flow — all of which will error in production. `src/types/database.ts` is hand-patched with "MANUAL ADDITION (pending regen)" notes because typegen was never run against a migrated DB.
**Do:** apply 0003–0021 in order via `supabase db push` (buckets from 0014 already exist manually — verify the migration's RESTRICTIVE storage policies actually got applied, since dashboard-created buckets have none of them), run the `supabase/tests/*.sql` suites against prod (or a branch first), regenerate `database.ts`, remove the manual-addition notes.

### 2. Drop the two rogue `USING (true)` policies in production
**Confirmed live:** `listings_select_authenticated` and `profiles_select_authenticated` exist in prod with `qual = true` but are not in any repo migration. They bypass the intended visibility rules and trigger the "multiple permissive policies" performance lint.
**Do:** `drop policy listings_select_authenticated on public.listings; drop policy profiles_select_authenticated on public.profiles;` — as a tracked migration so drift can't recur. Re-run the advisors afterward.

### 3. Remove the test-notification function from production
**Confirmed live:** `create_test_notification()` (`0017_test_notification.sql`) is deployed and callable by any signed-in user — anyone can inject arbitrary fake notifications for themselves. Dev-only tooling must not ship.
**Do:** drop the function in prod (migration guarded by environment, or a follow-up migration that drops it), and exclude 0017 from prod pushes going forward.

### 4. Turn on the signup email-domain hook and email confirmations
The `@uwo.ca` student gate exists client-side (`src/lib/email.ts`) and server-side (`0018_signup_email_hook.sql`) — but the server hook **must be manually enabled** in the dashboard (the migration says so at `0018:12-16`) and `config.toml:279` shows it commented out. Until enabled, anyone with the anon key can `signUp` with any email. Separately, `enable_confirmations = false` (`config.toml:226`) means email ownership is never proven if prod mirrors it.
**Do:** in the production project, enable the `before_user_created` hook pointing at `signup_email_hook`, enable email confirmations, then verify with (a) a non-uwo signup → rejected, (b) a uwo signup → requires the emailed code.

### 5. Harden auth settings
Supabase security advisor: leaked-password protection (HaveIBeenPwned check) is **disabled**; local config has `minimum_password_length = 6` with no complexity requirements.
**Do:** enable leaked-password protection in the prod dashboard; raise minimum length to 8+ and set `password_requirements`. Also revoke `EXECUTE` from `anon` on `my_listing_save_counts`, `notify_on_message`, `notify_on_saved_listing` (advisor: anon-executable `SECURITY DEFINER` functions — trigger functions shouldn't be RPC-callable at all).

---

## P0 — Launch blockers: Release infrastructure

### 6. Create the EAS build pipeline
There is no `eas.json` and no `extra.eas.projectId`/`owner` in `app.json` — there is currently **no path to a store binary**.
**Do:** `eas init`, then add `eas.json` with `development` / `preview` / `production` profiles and submit config (Apple team + ASC app ID, Play service account). Tracked already as AX-904 in `PROJECT_ROADMAP.md`.

### 7. Add crash reporting and a React error boundary
Zero error tracking (no Sentry/Bugsnag/Crashlytics anywhere) and no `ErrorBoundary` in the tree — a render throw white-screens the app and you'll never know it happened (tracked as AX-903).
**Do:** add `@sentry/react-native` (Expo-supported), wrap `RootNavigator` in an error boundary with a styled fallback + "restart" action, report caught errors, and wire the React Query error path / `QueryProvider` 401 handler into breadcrumbs.

### 8. Complete `app.json` for store submission
Missing: `scheme` (deep links cannot work; `NavigationContainer` at `App.tsx:174` has no `linking` config either, even though route params were designed to be deep-linkable), `ios.buildNumber` / `android.versionCode`, `ios.infoPlist.ITSAppUsesNonExemptEncryption` (App Store submission will stall on the encryption question), and privacy-manifest config.
**Do:** add `expo.scheme` (e.g. `axis`), a `linking` config mapping ListingDetail/Chat/SellerProfile, build numbers, the encryption declaration (`false` — standard HTTPS/keychain crypto is exempt), and verify the photo/camera permission strings read well in review.

### 9. Prepare store metadata & legal surface
Store review requires: privacy policy at a public URL (the in-app `PrivacyPolicyScreen` text needs to live on the web too), support URL/email, screenshots, age rating, and — because this is a UGC marketplace with messaging — Apple will check for **content moderation, block, and report** (you have all three ✅) plus **EULA/objectionable-content terms**. Provide a demo `@uwo.ca` test account in App Review notes since signup is domain-gated, or reviewers cannot log in and will reject.

---

## P1 — High priority (fix before or at launch)

### Backend & data

10. **Fix RLS performance lints (~20 policies).** Every policy re-evaluates `auth.uid()` per row (advisor: `auth_rls_initplan`, on profiles/listings/saved/messages/blocks/notifications/reports). Rewrite each as `(select auth.uid())` in one migration. Also add the two missing FK indexes the advisor flagged: `notifications(actor_id)`, `notifications(listing_id)`.
11. **Rate-limit abuse surfaces.** `messages` and `reports` inserts have no throttle — a user can spam unbounded (`MessageRepository.ts:152-168`, `ReportRepository.ts:15-24`). Add per-user recent-row-count triggers (e.g. max N messages/minute, M reports/day) or an edge-function gate.
12. **Bound the unbounded queries.** `getBySeller`, `getSavedByUser`, `ReviewRepository.listForSeller`, and follows lists fetch every row with no `limit` — only PostgREST `max_rows=1000` saves you. Add `.range()` pagination (the feed/search infinite-query pattern in `useListings.ts` is the template). Notifications are the inverse problem: hard-capped at 30 with no "load more" (`NotificationRepository.ts:24`).
13. **Add a search index.** Search is leading-wildcard `ILIKE '%term%'` on title+description (`ListingRepository.ts:351-369`) — a full table scan as the catalog grows. Add a `pg_trgm` GIN index (matches the existing ILIKE semantics exactly).

### App

14. **Virtualize the profile lists.** `SellerProfileScreen.tsx:206-215` renders the whole listings grid via `.map` in a ScrollView, and both profile screens map all reviews unvirtualized. Switch to `FlatList numColumns={2}` with header components; also wrap `ListingCard` in `React.memo` and stabilize the inline `renderItem` closures on Home/Saved/Search/Messages.
15. **Ship or hide dead controls.** These render as tappable but do nothing: "Forgot password?" (`SignInScreen.tsx:83` — this one is a real gap, password reset must exist at launch), Home "See all" (`HomeScreen.tsx:102`), Messages header search (`MessagesScreen.tsx:105`), and five Settings rows — Change password, Payment & payouts, Blocked users, Help & support, Report a problem (`SettingsScreen.tsx:187-216`). "Blocked users" matters most: blocking exists but users can't view/undo blocks anywhere.
16. **Fix price rendering.** Prices render as raw `${item.price}` in 7+ places — no thousands separators, and free/trade listings show as **"$0"** despite `isFree`/`isTrade` existing. Add one `formatPrice(listing)` helper (`Intl.NumberFormat`, "Free" / "Trade" labels) and use it everywhere (`ListingCard.tsx:49`, `ListingDetailScreen.tsx:313`, `ChatScreen.tsx:292`, `ProfileScreen.tsx:189`, `ManageListingsScreen.tsx:86`, …).
17. **Replace `Alert.alert` (28 call sites) with the in-app patterns.** The app already has a polished styled confirm modal (`SettingsScreen.tsx:279-331`) and a banner system (`NotificationBannerContext`). Extract the confirm modal into a shared `ConfirmDialog` + a `useToast`-style error banner, and migrate destructive confirms and error alerts. OS alerts read as unfinished and can't be branded.
18. **Fix the two "image never loads" bugs.** Chat header listing thumb is a solid color block that never loads the listing photo (`ChatScreen.tsx:289`), and the ListingDetail seller card re-implements initials-only instead of using `Avatar`, so seller photos never show there (`ListingDetailScreen.tsx:348-350`).
19. **Add missing loading/error/refresh states on buyer-critical screens.** SellerProfile: no skeleton, no error state, no pull-to-refresh (both queries' `isError` ignored). Profile: same, plus a literal `' '` placeholder rendering as a blank line (`ProfileScreen.tsx:134`). ListingDetail: bare spinner, no pull-to-refresh. Reuse `ListingCardSkeleton` / `ErrorState` / `RefreshControl` — the components already exist.

### Notifications & updates

20. **Push notifications.** In-app notifications exist but nothing reaches a closed app — fatal for a messaging marketplace (`NotificationBannerContext.tsx:40-44` explicitly defers this). Add `expo-notifications`, a `device_push_tokens` table, and fan out from the existing DB notification triggers (edge function or webhook → Expo push API). Route notification taps via the new `linking` config (task 8).
21. **OTA updates.** Add `expo-updates`, a `runtimeVersion` policy, and an EAS Update channel per build profile so bug fixes don't require a store round-trip.

---

## P2 — UI professionalism & consistency (fast-follow)

22. **Extract the 5 duplicated primitives.** (a) `Chip/FilterChip` — reimplemented 5× with drifting radius/padding (Home/Saved/Messages/ManageListings/Search); (b) `ScreenHeader` — the back-circle + centered title header is copy-pasted ~7×; (c) `IconButton` — the 38px `surfaceAlt` circle appears in nearly every header's styles; (d) `Card` — white + radius + `SHADOWS.card` re-declared 7+ times; (e) `LegalArticleScreen` — Privacy/Terms/Guidelines are three verbatim copies differing only in content. Also unify the program/year picker duplicated (and drifted — haptics on one, not the other) between SetupProfile and EditProfile.
23. **Tokenize the stray colors and sizes.** Off-palette literals: `#C4B2E0` (CreateListing/Profile), `#F8F3FF` (VerifyEmail — should be `primaryTint`), `#FEE8E8` (Notifications), `#FBF1E1`/`#A9700F` (LockedHint amber — add a proper warning-soft token), `#F5F5FA`/`#000` shadows in Search (should be `surfaceAlt` / `SHADOWS.card` — Search and Home deliberately pixel-match, so the shadow divergence is a visible seam). Font sizes 11/12.5/13/15/17 are freehand off the `SIZES` scale — extend the scale or snap to it. Fix the off-brand near-black active chip in `MessagesScreen.tsx:229-240` (should be `COLORS.primary`).
24. **Accessibility pass.**
    - **Contrast:** `COLORS.textMuted` `#9E9EAE` on white is ≈2.6:1 — fails WCAG AA for the small meta text it's used on everywhere. Darken it (e.g. `#6E6E7E`-range) or reserve it for large text.
    - **Labels/roles:** the `TouchableOpacity`-based screens (Welcome, SignIn, CreateAccount, VerifyEmail, SetupProfile, Home chips, Saved tabs, Messages rows/filters) lack `accessibilityRole`/`Label`/`State`; the `PressableScale` flows already do this well — match them. The terms checkbox needs `role="checkbox"` + `checked` state.
    - **Dynamic type:** all sizes are fixed and inputs have fixed heights — pick a strategy (`maxFontSizeMultiplier` ~1.3 on constrained rows, flexible heights elsewhere) so OS large-text doesn't clip.
25. **Adopt the Expo native-UI polish patterns** (from Expo's guidelines, all compatible with the current React Navigation + SDK 54 setup):
    - `borderCurve: 'continuous'` on all rounded cards/buttons — iOS "squircle" corners, the single cheapest way to look native-professional.
    - Migrate `SHADOWS` presets to the CSS `boxShadow` style prop (New Architecture) instead of legacy `shadowColor/shadowOffset/elevation` — one string per preset, consistent cross-platform.
    - Haptics on the onboarding path (Welcome/SignIn/CreateAccount/SetupProfile buttons) and Home category chips — coverage is currently inconsistent (present on listing flows, absent on auth).
    - `<Text selectable>` on error messages and copyable data (prices, order-ish info).
    - Compact large numbers (1.4k saves) where counts appear.
    - Consider `contentInsetAdjustmentBehavior="automatic"` on scrollers instead of manual inset math where headers allow.
26. **Convert Welcome-screen buttons to the shared primitives.** Hand-rolled `TouchableOpacity` + inline `#000` shadows; use `PrimaryButton`/`PressableScale` so the very first screen matches the rest of the app.
27. **PhotoPicker: use `expo-image`** for the local gallery (`PhotoPicker.tsx:129` uses plain RN `Image` with full-res camera photos — memory spike risk on older devices).
28. **Small-state fixes:** bio character counter on SetupProfile (EditProfile has one), setup-avatar camera button is inert (wire it or remove the affordance), Chat could use message skeletons + older-message pagination.

---

## P3 — Post-launch / quality of life

29. **Lint & format tooling:** no ESLint/Prettier at all. Add `eslint-config-expo` + Prettier + a CI lint step; add `coverageThreshold` to Jest and a `supabase gen types` drift check + `expo export` smoke step to CI.
30. **Screen smoke tests:** the entire UI layer (including the auth/onboarding gate in `App.tsx:60-147`) has zero tests. Start with the navigation gate and the signup flow.
31. **Analytics:** no product analytics (PostHog/Amplitude) — you'll be blind to funnels and retention at launch.
32. **Offline resilience:** React Query cache is memory-only; an offline-sent message optimistically appears then rolls back. Consider `persistQueryClient` + a mutation queue for chat.
33. **Nav param hygiene:** `SellerProfile` receives a whole profile object as a route param — pass `sellerId` and fetch, like `ListingDetail` does.
34. **Decisions to confirm:** light-mode-only (`userInterfaceStyle: "light"`) and no-tablet (`supportsTablet: false`) are fine for v1 — just confirm they're intentional. Anonymous read access to profiles is a documented trade-off (`0002_rls_policies.sql:71-86`); if anon browsing isn't needed, scope those policies to `authenticated`.

---

## What's already production-grade (keep doing this)

- **Architecture enforcement:** `scripts/check-architecture.sh` fails CI if a screen imports Supabase directly; strict TS with zero `any`/`@ts-ignore`; zero stray `console.log`.
- **Security:** encrypted session storage working around SecureStore's 2KB cap (`src/lib/supabase.ts`); comprehensive RLS with narrowly-granted, `search_path`-pinned `SECURITY DEFINER` functions; server-computed `verified` flag; PostgREST injection guards on `.or()` filters and search text; moderation tables revoked from client roles.
- **Data layer:** leak-free realtime channels with the re-subscribe race handled; real infinite-query pagination on feed/search; errors surfaced, not swallowed; idempotent, well-commented migrations with the right indexes on hot paths.
- **UI foundations:** complete token system (`theme.ts`), skeleton/empty/error/refresh coverage on all core list screens, `KeyboardAvoidingView` on every form, strong a11y on the `PressableScale` flows, tabular-nums on prices, optimistic saves with rollback, iMessage-style chat polish.

## Suggested execution order

1. **Week 1 — unblock the backend:** tasks 1–5 (migrations, rogue policies, test function, auth hooks/settings). Everything else is pointless if the DB is broken.
2. **Week 1–2 — release rails:** tasks 6–9 (EAS, Sentry + error boundary, app.json, store metadata).
3. **Week 2–3 — launch-critical app fixes:** tasks 10–19 (RLS perf, rate limits, pagination, dead controls incl. password reset, price formatting, alerts, missing states).
4. **Week 3–4 — push + OTA (20–21), then the P2 UI consistency pass (22–28).**
5. **Post-launch:** P3.
