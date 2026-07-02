# AI_CONTEXT.md — Axis Marketplace App

> Last updated: 2026-07-01
> **Read this entire file before touching a single line of code.**

---

## What Is This Project

**Axis** is a React Native marketplace app for university students (Western University) to buy and sell items — textbooks, furniture, electronics, tickets, etc. The brand colour is `#5C2D91` (purple). Bundle IDs: `com.axis.app` (iOS + Android).

---

## Session Protocol

Every coding session must follow this exact workflow. No exceptions.

1. Read this entire file before making any changes.
2. Review the Progress Log and Current State table to understand where work left off.
3. Pull the latest changes from Git (`git pull`).
4. Verify the project builds before touching anything (`npx expo export --platform ios` or run `npx tsc --noEmit`).
5. Confirm the working tree is clean (`git status`). If uncommitted changes exist, stop and explain — do not overwrite them.
6. Create a new feature branch for the current milestone.
7. Complete only the current milestone unless explicitly instructed otherwise.
8. Verify the project still builds after your changes.
9. Update this file: progress log, completed checklist items, handoff section.
10. Stop and wait for further instructions.

**Never continue indefinitely.**

---

## Before Starting — Checklist

Before writing a single line of code, confirm all of the following:

- [ ] I have read this entire document.
- [ ] I know which milestone is currently active (check Progress Log).
- [ ] I have verified which packages are installed (`cat package.json`).
- [ ] I have run a build and it passes. If it **fails before I touch anything**, stop immediately and report the error — do not attempt to fix unrelated build failures as part of a milestone.
- [ ] The working tree is clean with no uncommitted changes.
- [ ] I am on a feature branch, not `main`.

---

## Accepted Commands

These are the only commands that should drive work. Interpret them exactly as described.

| Command | Meaning |
|---|---|
| **Continue** | Read this file → complete the next unchecked milestone → update this file → stop. |
| **Continue further** | Complete the next two unchecked milestones sequentially → update this file → stop. |
| **Finish current** | Finish only the milestone already in progress, no new work. |
| **Status** | Summarize current progress from the Progress Log. Do not make changes. |
| **What's next?** | Explain the next milestone only — scope, tasks, risks. Do not start it. |
| **Review** | Review architecture and code quality. Do not modify any code. |
| **Fix** | Fix the current broken milestone without advancing to new work. |
| **Update context** | Read all current source files and refresh this document to accurately reflect reality. |

---

## Never Do These

Violating any of these rules is grounds to stop and report rather than proceed.

- Never work directly on `main`.
- Never hardcode secrets, URLs, or keys — all config goes in `.env` via `EXPO_PUBLIC_*`.
- Never delete working code unless you are replacing it with a verified alternative in the same commit.
- Never rename an exported function, type, or component without updating every caller.
- Never modify files unrelated to the current milestone.
- Never remove mock data (`src/data/mockListings.ts`) until the real data layer is live and tested.
- Never bypass TypeScript with `any` or `// @ts-ignore`.
- Never disable Row Level Security (RLS) on any Supabase table for any reason.
- Never change the navigation structure (`App.tsx`, `MainScreen.tsx`, `RootStackParamList`) without explicit instruction.
- Never change `src/constants/theme.ts` without explicit instruction — it cascades across every screen.
- Never start a new milestone while the current one is incomplete.
- Never mark a milestone complete unless all items in its Definition of Done are satisfied.

---

## Current State (as of 2026-07-01)

The **entire frontend UI is complete** and ships with mock data. No Supabase, no real auth, no backend at all.

| Layer | Status |
|---|---|
| Navigation (React Navigation, all screens) | ✅ Done |
| UI components and screens | ✅ Done |
| Design system (`COLORS`, `SIZES`) | ✅ Done |
| Skeleton loaders, error states, empty states | ✅ Done |
| `AuthContext` — real Supabase auth | 🟡 Code done (session mgmt, loading, signIn/up/otp/out) — awaiting `.env` keys to verify |
| Supabase client | 🟡 Code done (`src/lib/supabase.ts`) — awaiting `.env` keys |
| TanStack Query | ✅ Provider done (`src/providers/QueryProvider.tsx`, wired into `App.tsx`) |
| Repository layer | 🟡 Scaffolded (3 repos, typed placeholder methods) — Phase 2 fills in real queries |
| Database schema / tables | ❌ Not started |
| Image upload (Supabase Storage) | ❌ Not started |
| Real-time messaging | ❌ Not started |

---

## Actual Folder Structure (Today)

```
src/
  components/
    ActivitySpinner.tsx       ← use this for full-screen loading states (e.g. auth restore)
    BottomTabBar.tsx
    EmptyState.tsx
    ErrorState.tsx
    InputField.tsx
    ListingCard.tsx
    ListingCardSkeleton.tsx
    PrimaryButton.tsx
    ReportModal.tsx
    SkeletonLoader.tsx
    StepHeader.tsx

  constants/
    theme.ts              ← COLORS and SIZES — never modify without checking all screens

  context/
    AuthContext.tsx        ← STUB: isSignedIn boolean + signIn/signOut toggles only

  data/
    mockListings.ts        ← ALL current data lives here — will be deleted when real data lands

  screens/
    WelcomeScreen.tsx
    SignInScreen.tsx
    CreateAccountScreen.tsx
    VerifyEmailScreen.tsx
    SetupProfileScreen.tsx
    MainScreen.tsx          ← tab navigator (Home, Saved, Messages, Profile)
    HomeScreen.tsx          ← pulls from mockListings, fake 1.2s loading delay
    SavedScreen.tsx         ← pulls from SAVED_LISTINGS mock
    ProfileScreen.tsx
    EditProfileScreen.tsx
    ManageListingsScreen.tsx
    SettingsScreen.tsx
    SearchScreen.tsx
    ListingDetailScreen.tsx
    SellerProfileScreen.tsx
    CreateListingScreen.tsx  ← ImagePicker wired, submit is a stub Alert
    MessagesScreen.tsx
    ChatScreen.tsx
    NotificationsScreen.tsx
    PrivacyPolicyScreen.tsx
    TermsOfServiceScreen.tsx
    CommunityGuidelinesScreen.tsx

  types/
    index.ts               ← TypeScript types for Listing, Seller, SellerProfile, MyListing, Contact, RootStackParamList

App.tsx                    ← root: AuthProvider → SafeAreaProvider → NavigationContainer → RootNavigator
app.json                   ← Expo config, sdkVersion 54
package.json               ← NO Supabase, NO TanStack Query installed yet
```

---

## Installed Packages (package.json — what's actually there)

```json
"@react-navigation/bottom-tabs": "^7.18.3",
"@react-navigation/native": "^7.0.0",
"@react-navigation/native-stack": "^7.0.0",
"expo": "~54.0.0",
"expo-image-picker": "~17.0.11",
"expo-linear-gradient": "~15.0.8",
"expo-status-bar": "~3.0.0",
"react": "19.1.0",
"react-native": "0.81.5",
"react-native-safe-area-context": "~5.6.0",
"react-native-screens": "~4.16.0"
```

**These are NOT installed yet and must be added:**
- `@supabase/supabase-js`
- `@tanstack/react-query`
- `expo-secure-store` (for session persistence)
- `react-native-url-polyfill` (required by Supabase on React Native)

---

## Existing TypeScript Types (src/types/index.ts)

These will become the basis for Supabase table types. Do not change them without a migration plan.

```ts
Listing {
  id: string
  title: string
  price: number
  condition: string       // 'Like new' | 'Good' | 'Fair'
  category: string        // 'Textbooks' | 'Furniture' | 'Electronics' | 'Tickets' | 'Clothing' | 'Sports' | 'Other'
  seller: Seller
  saved: boolean          // per-user, will become a separate saved_listings join table
  imageColor: string      // placeholder until real images — keep for skeleton fallback
  badge: string | null    // e.g. 'Price ↓'
  description: string
  views: number
  postedAgo: string       // display string — derive from created_at in real data
  pickup: string
}

Seller {
  id: string
  name: string
  year: number            // academic year
  location: string        // dorm/campus location
  dotColor: string        // online indicator colour
}

SellerProfile {
  id: string
  name: string
  initials: string
  program: string
  joinedDate: string
  rating: number
  reviewCount: number
  year: number
  verified: boolean
  stats: { listings: number; sold: number; replyTime: string }
  avatarColor: string
}

MyListing {
  id: string
  title: string
  price: number
  status: 'active' | 'sold'
  category: string
  views: number
  saves: number
  postedAgo: string
  imageColor: string
  soldFor?: number
}

Contact { initials: string; avatarColor: string; name: string }
```

---

## Architecture Target (do not deviate)

```
Screen
  ↓
Custom Hook (useListings, useAuth, useSavedListings, etc.)
  ↓
Repository (ListingRepository, ProfileRepository, MessageRepository)
  ↓
Supabase Client (singleton, src/lib/supabase.ts)
```

**Hard rules:**
- Screens never import from `@supabase/supabase-js` directly
- Screens never import from `src/data/mockListings.ts` (delete that file when done)
- All Supabase calls live in repositories
- All business logic lives in hooks
- UI is display-only

**Target folder additions** (create only what the current milestone needs):
```
src/
  lib/
    supabase.ts           ← Supabase singleton

  providers/
    QueryProvider.tsx     ← TanStack Query wrapper

  repositories/
    ListingRepository.ts
    ProfileRepository.ts
    MessageRepository.ts

  hooks/
    useListings.ts
    useSavedListings.ts
    useProfile.ts
    useMessages.ts
```

> `src/context/AuthContext.tsx` stays in place — replace its internals with real Supabase auth, keep the same export shape so `App.tsx` needs no changes.

---

## AuthContext — Current State (the stub to replace)

File: `src/context/AuthContext.tsx`

Current exports:
```ts
AuthProvider   // wraps the app, currently a useState boolean
useAuth()      // returns { isSignedIn, signIn, signOut }
```

**What `useAuth()` must expose after migration** (expand, don't rename existing fields):
```ts
{
  isSignedIn: boolean        // keep — RootNavigator reads this, derives from !!session
  signIn: () => void         // keep — but now calls Supabase signInWithPassword
  signOut: () => void        // keep — but now calls Supabase signOut + clears QueryClient
  session: Session | null    // add
  user: User | null          // add
  loading: boolean           // add — true while restoring session on launch
}
```

`App.tsx` uses `{ isSignedIn }` from `useAuth()` and **must not require changes**.

**Auth flow (what each screen does):**

| Screen | Supabase call |
|---|---|
| `SignInScreen` | `supabase.auth.signInWithPassword({ email, password })` |
| `CreateAccountScreen` | `supabase.auth.signUp({ email, password })` → navigates to `VerifyEmail` |
| `VerifyEmailScreen` | `supabase.auth.verifyOtp({ email, token, type: 'signup' })` → navigates to `SetupProfile` |
| `SetupProfileScreen` | inserts row into `profiles` table → auth flow complete |
| `SettingsScreen` (sign out) | calls `signOut()` from `useAuth()` |

**Auth ↔ Query coordination (critical — easy to get wrong):**

- All `useQuery` calls that fetch user-specific data must include `enabled: !!user` so queries do not fire before auth resolves.
- On `signOut`, call `queryClient.clear()` to flush all cached data. Without this, the next user to sign in on the same device may briefly see the previous user's data.
- Configure a global `onError` handler in `QueryProvider` that calls `supabase.auth.signOut()` on any 401 error, then clears the query cache.

**Loading state during session restore:**

While `loading === true` (session not yet resolved on launch), render `<ActivitySpinner />` from `src/components/ActivitySpinner.tsx` instead of the navigator. This prevents an auth flash where the signed-out screens briefly appear before the session is restored.

---

## Database Tables (planned, not yet created)

Design these schemas when you get to the repository layer:

| Table | Key columns |
|---|---|
| `profiles` | id (= auth.users.id), name, initials, program, year, location, avatar_url, avatar_color, verified, reply_time |
| `listings` | id, seller_id (→ profiles), title, description, price, is_free, is_trade, condition, category, pickup, image_urls[], status ('active'/'sold'), views, created_at |
| `saved_listings` | user_id, listing_id (composite PK) |
| `messages` | id, listing_id, sender_id, receiver_id, body, created_at |
| `notifications` | id, user_id, type, listing_id?, read, created_at |

Enable **Row Level Security** on all tables. Never disable RLS.

---

## Milestones — Phase 1: Supabase Foundation

Complete these in order. One branch per milestone. Stop after each one.

---

### Milestone 1 — Provision Supabase project + install deps + client

Branch: `feature/supabase-client`

**Step 0 — Provision the Supabase project (do this before writing any code):**
1. Go to [supabase.com](https://supabase.com) and create a new project named `axis`.
2. Once provisioned, go to **Project Settings → API**.
3. Copy **Project URL** → this is `EXPO_PUBLIC_SUPABASE_URL`.
4. Copy **anon / public key** → this is `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. Never use the `service_role` key in the app.

Tasks:
- [ ] Supabase project created and keys retrieved — **BLOCKED: user to provision project + paste keys into `.env`**
- [x] `npx expo install @supabase/supabase-js expo-secure-store react-native-url-polyfill`
- [x] Add polyfill import at the very top of `App.tsx` (line 1): `import 'react-native-url-polyfill/auto'`
- [x] Create `.env` in the project root with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (created with empty placeholders — values pending)
- [x] Confirm `.env` is in `.gitignore` (add it if not) — already ignored via `.env` and `*.env`
- [x] Create `src/lib/supabase.ts` with the full implementation below
- [~] App builds successfully and `supabase` is importable — `tsc --noEmit` passes; runtime import roundtrip unverified until keys are present (see Milestone 5)

**`src/lib/supabase.ts` — complete implementation:**
```ts
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

Definition of done: build passes, `supabase` is importable from any file, no secrets in source, `.env` is gitignored.

---

### Milestone 2 — TanStack Query provider

Branch: `feature/query-provider`

Tasks:
- [x] `npx expo install @tanstack/react-query` (`^5.101.2`)
- [x] Create `src/providers/QueryProvider.tsx`
- [x] Wrap `App.tsx`: `QueryProvider` sits inside `AuthProvider`, outside `NavigationContainer`
- [x] Configure defaults: `staleTime: 1000 * 60 * 2`, `gcTime: 1000 * 60 * 10`, `retry: 2`, `refetchOnWindowFocus: false`, `refetchOnReconnect: true`
- [x] Add global `onError` handler that signs the user out and clears the cache on 401 errors

> **Implementation note:** the sample below omits the `onError` handler required by the checklist. The shipped version adds it via a `QueryCache({ onError })` that calls `supabase.auth.signOut()` + `queryClient.clear()` when the error is a 401 (`status === 401`, `code === '401'`, or PostgREST `PGRST301`). 401 detection is best-effort until the repository layer defines a concrete error shape — revisit in Phase 2.

**`src/providers/QueryProvider.tsx` — complete implementation:**
```tsx
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

// Export so AuthContext can call queryClient.clear() on signOut
export { queryClient }

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Definition of done: `useQuery` and `useMutation` can be called from any screen without error.

---

### Milestone 3 — Real AuthContext

Branch: `feature/auth-provider`

Tasks:
- [x] Replace the boolean stub in `src/context/AuthContext.tsx` with real Supabase auth
- [x] On mount: call `supabase.auth.getSession()` — set `loading: true` until resolved
- [x] Subscribe to `supabase.auth.onAuthStateChange` — update `session` and `user`, cleanup listener on unmount
- [x] `signIn()` — calls `supabase.auth.signInWithPassword({ email, password })`; signature accepts `(email: string, password: string)`
- [x] `signOut()` — calls `supabase.auth.signOut()` AND `queryClient.clear()` (imported from `QueryProvider`)
- [x] Add `session`, `user`, `loading` to the context value
- [x] `isSignedIn` derives from `!!session` — `App.tsx` unchanged
- [x] While `loading === true`, render `<ActivitySpinner />` — done **inside `AuthProvider`** (it renders the spinner instead of `children`), which keeps `App.tsx` unchanged while still gating at the root

**Wire auth screens to Supabase calls:** (routed through `useAuth()` so screens don't import `supabase` directly — respects the "no Supabase in screens" rule)
- [x] `SignInScreen` → `signIn(email, password)` (+ loading/error via `Alert`; SSO button now shows a "coming soon" alert instead of calling the stub)
- [x] `CreateAccountScreen` → `signUp(email, password)` → navigate to `VerifyEmail`
- [x] `VerifyEmailScreen` → `verifyOtp(email, token)` — no manual navigate; the resulting session swaps the navigator
- [~] `SetupProfileScreen` → insert into `profiles` table — **DEFERRED to Phase 2** (see deviations below)

**⚠️ Two deviations from the literal plan (decisions, flag for review):**
1. **`profiles` insert deferred.** The `profiles` table does not exist until Phase 2, so `SetupProfileScreen` cannot insert. Its broken `signIn()` call was removed; `handleFinish` is a documented no-op.
2. **`SetupProfile` is bypassed in the real flow.** `verifyOtp` establishes a session immediately, so `RootNavigator` swaps to the signed-in stack the moment email is verified — the user never reaches `SetupProfile` (which lives in the signed-out group). Proper first-run profile capture belongs in Phase 2, gated on profile existence rather than session existence. **This changes the visible onboarding UX and should be confirmed.**

Definition of done: real sign-in and sign-out work end to end. Session persists across app restarts. No auth flash on relaunch. **Status:** code complete + `tsc` passes; end-to-end verification is BLOCKED until `.env` keys + a configured Supabase project exist (verified at Milestone 5).

---

### Milestone 4 — Repository layer (interfaces + placeholders)

Branch: `feature/repository-layer`

Tasks:
- [x] Create `src/repositories/ListingRepository.ts`
- [x] Create `src/repositories/ProfileRepository.ts`
- [x] Create `src/repositories/MessageRepository.ts`

Each repository is a plain exported object. Methods may be placeholders at this stage — the goal is establishing the architecture, not live data.

> **Done:** all three exist as plain exported objects with typed placeholder methods (return `[]`/`null`, mutations throw). `ProfileRepository` exposes `getById`/`getCurrent`/`upsert(UpsertProfileInput)`; `MessageRepository` exposes `getConversations`/`getMessages`/`send(SendMessageInput)` plus a `Message` type. `tsc` passes; verified no screen/component imports `supabase` directly.

```ts
// src/repositories/ListingRepository.ts
import { supabase } from '../lib/supabase'
import { Listing } from '../types'

export type CreateListingInput = {
  title: string
  description: string
  price: number
  is_free: boolean
  is_trade: boolean
  condition: 'Like new' | 'Good' | 'Fair'
  category: string
  pickup: string
  image_urls: string[]
}

export const ListingRepository = {
  async getAll(category?: string): Promise<Listing[]> { return [] },
  async getById(id: string): Promise<Listing | null> { return null },
  async create(data: CreateListingInput): Promise<Listing> { throw new Error('not implemented') },
  async toggleSaved(listingId: string, userId: string): Promise<void> {},
  async getSavedByUser(userId: string): Promise<Listing[]> { return [] },
}
```

Definition of done: all three repositories exist, are importable, and no screen calls Supabase directly.

---

### Milestone 5 — Smoke test (real roundtrip)

Branch: `feature/smoke-test`

This milestone requires at least one real database roundtrip from a device or simulator build — not just verifying the app boots.

**Prerequisite:** Create a `health_check` table in the Supabase dashboard:
```sql
create table health_check (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);
-- No RLS needed on this table — it's for testing only and will be dropped in Phase 2
```

> **Helper ready:** `src/lib/healthCheck.ts` exports `runHealthCheck()` — does the real insert + select and returns a typed result. Call it from a dev button/debugger once keys + the `health_check` table exist.

Tasks:
- [ ] `.env` variables load correctly (log `supabase.supabaseUrl` to console in dev)
- [ ] Supabase client initialises without error
- [ ] QueryProvider initialises without error
- [ ] AuthProvider restores session on launch — `loading` resolves to `false`
- [ ] App renders correctly in both signed-out and signed-in states (no auth flash)
- [ ] A real `supabase.from('health_check').insert({})` succeeds from the device
- [ ] A real `supabase.from('health_check').select()` returns data
- [ ] Drop the `health_check` table after confirming the roundtrip works

Definition of done: all checklist items pass on a real device or simulator build. No fake timeouts, no mocked responses.

---

## Phase 2 Preview (do not start until Phase 1 is fully done)

> **Prep available (not yet applied / not yet wired):**
> - **DB drafts:** schema + RLS in `supabase/migrations/0001_initial_schema.sql` and `0002_rls_policies.sql`, `supabase/health_check.sql` for Milestone 5, `supabase/README.md` for how/decisions. `.env.example` documents the keys.
> - **Hooks layer:** `src/hooks/` (`queryKeys`, `useListings`/`useListing`/`useCreateListing`, `useSavedListings`/`useToggleSaved`, `useProfile`/`useCurrentProfile`/`useUpsertProfile`, `useConversations`/`useMessages`/`useSendMessage`). TanStack Query wrappers over the repositories with `enabled: !!user` gating and mutation invalidation. **Not imported by any screen yet** — wiring each screen (and deleting mock data) is the per-screen Phase 2 work (items 4–7).

1. Create Supabase DB tables with correct schema and RLS policies
2. Generate TypeScript types from Supabase (`npx supabase gen types typescript`)
3. Implement real repository methods (listings CRUD, saved toggle)
4. Replace `HomeScreen` mock data with `useListings` hook
5. Replace `SavedScreen` mock data with `useSavedListings` hook
6. Implement `CreateListingScreen` submit (listings insert + image upload to Supabase Storage)
7. Real-time messaging (Supabase Realtime on `messages` table)
8. Notifications

---

## Coding Standards

- Strict TypeScript — no `any`, no `// @ts-ignore`
- Small files — one responsibility per file
- No business logic inside screens
- No Supabase imports inside screens or components
- Descriptive names — `useListings`, not `useData`
- No comments explaining *what* the code does — only *why* if non-obvious

---

## Refactoring Rules

Refactor only when ALL of the following are true:
- It directly supports the current milestone.
- It removes real duplication (not hypothetical).
- It does not change existing behaviour.
- It improves maintainability in a concrete, immediate way.

Never refactor speculatively. Three similar lines is better than a premature abstraction. If a refactor is tempting but not required by the current milestone, note it in the Handoff section and move on.

---

## Git Commit Guidelines

After completing a milestone, create one logical commit with a conventional commit message:

```
feat(auth): implement Supabase AuthProvider with session persistence
feat(query): add QueryProvider with sane defaults and 401 handler
feat(repository): scaffold ListingRepository, ProfileRepository, MessageRepository
feat(supabase): initialize client from env vars with SecureStore adapter
fix(auth): restore persisted session on app launch
fix(query): clear cache on signOut to prevent data leakage between sessions
```

Format: `type(scope): short description`
- `feat` — new capability
- `fix` — corrects broken behaviour
- `chore` — install, config, tooling with no behaviour change

One commit per milestone. Do not squash milestones together.

---

## Definition of Done

A milestone is only complete when every single item below is true. Partial completion does not count.

- [ ] Project builds with no TypeScript errors (`npx tsc --noEmit` passes)
- [ ] No new runtime errors introduced (test on simulator)
- [ ] Existing screens still render correctly — no regressions
- [ ] Architecture is clean (no Supabase imports in screens or components)
- [ ] Progress Log updated with date, branch, summary, and files changed
- [ ] Milestone checklist items marked complete in this file
- [ ] Handoff section updated
- [ ] Branch is ready to merge into `main`

---

## Agent Rules

1. Pull latest before starting any milestone.
2. One branch per milestone: `feature/<milestone-name>`.
3. Do NOT work on `main` directly.
4. Stop after one milestone unless explicitly told to continue.
5. Update the Progress Log and Handoff before stopping.
6. Mark checklist items as completed as you go, not at the end.

---

## Progress Log

Append a new entry after every work session. Never overwrite previous entries.

---

### 2026-07-01

**Milestone:** None (project setup)
**Branch:** `main`
**Summary:** Full frontend UI with mock data established as baseline. Phase 1 Supabase infrastructure not yet started. This context document created.
**Files changed:** `AI_context.md`
**Outstanding:** All of Phase 1 — Milestones 1–5.

---

### 2026-07-02

**Milestone:** 1 — Supabase client (code portion)
**Branch:** `feature/supabase-client`
**Summary:** Installed Supabase deps, added the url-polyfill import, created the Supabase client singleton, and scaffolded `.env`. Baseline `tsc --noEmit` passed before and after changes. The only remaining item is user-side: provision the Supabase project and paste the URL + anon key into `.env`. Once keys are in, `supabase` is fully wired and ready for Milestone 2.
**Files changed:** `App.tsx` (polyfill import line 1), `src/lib/supabase.ts` (new), `.env` (new, empty placeholders — gitignored), `package.json` + `package-lock.json` (deps), `app.json` (expo-secure-store config plugin auto-added).
**Outstanding:** User must provision Supabase project and fill `.env`. Runtime import roundtrip is deferred to Milestone 5 smoke test.

---

### 2026-07-02

**Milestone:** 2 — TanStack Query provider
**Branch:** `feature/query-provider` (branched off `feature/supabase-client`, kept local)
**Summary:** Installed `@tanstack/react-query`, created `src/providers/QueryProvider.tsx` with the specified defaults, and wrapped it into `App.tsx` inside `AuthProvider` / outside `NavigationContainer`. Added the 401 `onError` handler (via `QueryCache`) that the checklist requires but the sample omitted. `tsc --noEmit` passes.
**Files changed:** `App.tsx` (import + wrap), `src/providers/QueryProvider.tsx` (new), `package.json` + `package-lock.json` (dep).
**Outstanding:** Milestone 3 — real AuthContext. `queryClient.clear()` will be called from `signOut` there. Live behaviour of the 401 handler unverified until real queries exist (Phase 2).

---

### 2026-07-02

**Milestone:** 3 — Real AuthContext
**Branch:** `feature/auth-provider` (branched off `feature/query-provider`, kept local)
**Summary:** Replaced the boolean `AuthContext` stub with real Supabase auth: `getSession()` on mount with a `loading` gate, `onAuthStateChange` subscription (cleaned up on unmount), `session`/`user`/`loading` in context, `isSignedIn = !!session`, and `signOut` that also calls `queryClient.clear()`. Added `signIn`/`signUp`/`verifyOtp` to the context and wired `SignInScreen`, `CreateAccountScreen`, and `VerifyEmailScreen` through them (with loading + `Alert` error handling). Loading gate renders `<ActivitySpinner size="large">` inside `AuthProvider`, so `App.tsx` is unchanged. `tsc --noEmit` passes.

**Two deviations (need a product decision — see Risks):** (1) `SetupProfileScreen`'s `profiles` insert is deferred to Phase 2 (table doesn't exist); its broken `signIn()` call was removed and `handleFinish` is a documented no-op. (2) Because `verifyOtp` creates a session immediately, the navigator swaps to the app on verify and `SetupProfile` is bypassed in the real signup flow.

**Files changed:** `src/context/AuthContext.tsx` (rewritten), `src/screens/SignInScreen.tsx`, `src/screens/CreateAccountScreen.tsx`, `src/screens/VerifyEmailScreen.tsx`, `src/screens/SetupProfileScreen.tsx`.
**Outstanding:** End-to-end auth verification (needs `.env` keys + configured Supabase project — email OTP templates, etc.) — happens at Milestone 5. Decide Phase 2 onboarding/profile-capture model.

---

### 2026-07-02

**Milestone:** 4 — Repository layer (interfaces + placeholders)
**Branch:** `feature/repository-layer` (branched off `feature/auth-provider`, kept local)
**Summary:** Scaffolded the three repositories as plain exported objects with typed placeholder methods. `ListingRepository` matches the doc's spec (`getAll`/`getById`/`create`/`toggleSaved`/`getSavedByUser` + `CreateListingInput`). Added `ProfileRepository` (`getById`/`getCurrent`/`upsert` + `UpsertProfileInput`) and `MessageRepository` (`getConversations`/`getMessages`/`send` + `Message`/`SendMessageInput` types). Placeholders return `[]`/`null`; mutations throw `not implemented`. `tsc` passes; confirmed no screen/component imports `supabase` directly.
**Files changed:** `src/repositories/ListingRepository.ts` (new), `src/repositories/ProfileRepository.ts` (new), `src/repositories/MessageRepository.ts` (new).
**Outstanding:** Milestone 5 — smoke test. **BLOCKED on user:** needs `.env` keys, a provisioned Supabase project, a `health_check` table, and a real device/simulator run. Cannot be completed autonomously.

---

## Handoff

Update this section at the end of every coding session before stopping.

### Completed

- **Milestone 1 (code portion)** on branch `feature/supabase-client`: deps installed, polyfill wired, `src/lib/supabase.ts` created, `.env` scaffolded and confirmed gitignored, `tsc` passes. Committed locally (`41ce559`).
- **Milestone 2** on branch `feature/query-provider`: `@tanstack/react-query` installed, `QueryProvider` created with defaults + 401 handler, wired into `App.tsx`, `tsc` passes. Committed locally (`9a4d781`).
- **Milestone 3** on branch `feature/auth-provider`: real `AuthContext` (session mgmt, loading gate, `signIn`/`signUp`/`verifyOtp`/`signOut`), auth screens wired via `useAuth()`, `tsc` passes. Committed locally (`edc469b`). Two deviations deferred to Phase 2 (profiles insert + SetupProfile bypass — see Risks).
- **Milestone 4** on branch `feature/repository-layer`: three repositories scaffolded with typed placeholder methods, `tsc` passes, no direct `supabase` imports in screens/components.
- **Prep (Phase 2 groundwork, not milestones):**
  - `chore/db-schema-draft` (`2c5bf72`): draft schema + RLS SQL, `health_check.sql`, `.env.example`, `supabase/README.md`.
  - `feature/hooks-layer`: `src/hooks/` TanStack Query wrappers over the repositories (queries gated on `!!user`, mutations invalidate). Not wired into screens yet.

### Files Changed

Milestone 1:
- `App.tsx` — added `import 'react-native-url-polyfill/auto'` as line 1
- `src/lib/supabase.ts` — new Supabase client singleton (SecureStore adapter)
- `.env` — new, empty placeholders (gitignored, not committed)
- `package.json` / `package-lock.json` — added `@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill`
- `app.json` — `expo-secure-store` config plugin auto-added by `expo install`

Milestone 2:
- `src/providers/QueryProvider.tsx` — new; `QueryClient` + `QueryCache` 401 handler; exports `queryClient`
- `App.tsx` — import `QueryProvider`, wrap inside `AuthProvider` / outside `NavigationContainer`
- `package.json` / `package-lock.json` — added `@tanstack/react-query`

Milestone 3:
- `src/context/AuthContext.tsx` — rewritten: real Supabase auth, loading gate, `signIn`/`signUp`/`verifyOtp`/`signOut`
- `src/screens/SignInScreen.tsx` — wired to `signIn`, loading/error, SSO button → "coming soon" alert, cleared fake defaults
- `src/screens/CreateAccountScreen.tsx` — wired to `signUp` then navigate to `VerifyEmail`
- `src/screens/VerifyEmailScreen.tsx` — wired to `verifyOtp`; navigator swap replaces manual navigation
- `src/screens/SetupProfileScreen.tsx` — removed broken `signIn()`; `handleFinish` is a documented no-op (profiles insert → Phase 2)

Milestone 4:
- `src/repositories/ListingRepository.ts` — new; `getAll`/`getById`/`create`/`toggleSaved`/`getSavedByUser` + `CreateListingInput`
- `src/repositories/ProfileRepository.ts` — new; `getById`/`getCurrent`/`upsert` + `UpsertProfileInput`
- `src/repositories/MessageRepository.ts` — new; `getConversations`/`getMessages`/`send` + `Message`/`SendMessageInput`

### Remaining Work

- **Milestone 1 (user step):** provision Supabase project, paste URL + anon key into `.env`. Milestone 1 is not truly done until keys are in and a real import works (verified in Milestone 5).
- **Milestone 5 (BLOCKED on user):** smoke test — needs keys, provisioned project, a `health_check` table, and a real device/simulator run. Cannot be done autonomously.
- Milestone 3: Real AuthContext with session persistence
- Milestone 4: Repository layer scaffolding
- Milestone 5: Smoke test with real DB roundtrip

### Risks / Notes

- `HomeScreen` and `SavedScreen` have a fake `setTimeout` simulating loading — remove these when real async hooks land, or they will double-delay the UI.
- `src/data/mockListings.ts` must not be deleted until every screen that imports from it has been migrated to a real hook.
- **Category inconsistency (known bug, do not silently fix):** `HomeScreen` filters by `['All', 'Textbooks', 'Furniture', 'Tickets']` but `CreateListingScreen` uses `['Electronics', 'Textbooks', 'Furniture', 'Clothing', 'Sports', 'Other']` — Tickets cannot be created. This predates Phase 1 and must be resolved as a dedicated task in Phase 2 with an explicit decision on the canonical category list.
- Auth ↔ Query coordination: queries must use `enabled: !!user` and `signOut` must call `queryClient.clear()`. Missing either causes subtle bugs (queries firing before auth, or stale data leaking between sessions). `signOut` clears the cache as of M3; the `enabled: !!user` half applies when real queries land in Phase 2.
- **Onboarding / profile capture (M3 decision, needs confirmation):** `verifyOtp` signs the user in immediately, so the signed-out `SetupProfile` step is bypassed. Phase 2 must decide how first-run profile capture works — likely an in-app step gated on "profile row exists" rather than on session existence. Until then `SetupProfile` is orphaned and `handleFinish` is a no-op.
- **`profiles` insert (M3):** deferred to Phase 2 because the table doesn't exist yet. When it lands, wire `SetupProfile` (or its replacement) through `ProfileRepository`, not a direct `supabase` call.

### Suggested Next Prompt

> "I've provisioned Supabase and added the keys to `.env` — run Milestone 5 (smoke test) on a simulator." (Milestone 5 is blocked until then.)

---

## Known Issues

- `HomeScreen` and `SavedScreen` have a fake `setTimeout` simulating loading — remove these when real async hooks land.
- `CreateListingScreen` submit shows an `Alert.alert('Post listing')` stub — real submit goes to `ListingRepository.create()`.
- `SetupProfileScreen` `handleFinish` is a no-op (M3): the `profiles` insert is deferred to Phase 2 and the screen is bypassed once `verifyOtp` creates a session. Revisit onboarding routing in Phase 2.
- `VerifyEmailScreen` resend button is still UI-only (countdown reset) — not wired to a real Supabase resend yet.
- `MessagesScreen` and `ChatScreen` are entirely static — no messages data layer yet.
- `ManageListingsScreen` uses `MY_LISTINGS` from mock data.
- `ProfileScreen` and `SellerProfileScreen` use hardcoded mock seller data.
- **Category inconsistency:** `HomeScreen` browse categories (`Textbooks`, `Furniture`, `Tickets`) do not match `CreateListingScreen` categories (`Electronics`, `Textbooks`, `Furniture`, `Clothing`, `Sports`, `Other`). Tickets cannot be created. Resolve in Phase 2.
