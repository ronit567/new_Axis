# Supabase — schema drafts

**Status: DRAFT.** These files are prepared ahead of Phase 2 so they can be
applied quickly once the Supabase project exists. Nothing here has been run
against a live database yet — review before applying.

## Files

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Tables (`profiles`, `listings`, `saved_listings`, `messages`, `notifications`), indexes, and `enable row level security` on each. |
| `migrations/0002_rls_policies.sql` | RLS policies. Apply **after** 0001. |
| `migrations/0003_storage_buckets.sql` | `listing-images` + `avatars` Storage buckets (with size/mime-type limits) and their `storage.objects` policies (authenticated upload to own prefix, public URL read via the bucket's `public` flag, owner-only delete). |
| `health_check.sql` | Throwaway table for the Milestone 5 smoke test. Drop it after. |

## How to apply (once Supabase is connected)

- **Via the Supabase MCP server** (preferred): run `0001`, `0002`, `0003`, then
  `health_check.sql`. I can drive this directly once the MCP is connected.
- **Via the dashboard**: paste each file into the SQL editor in order.
- **Via the CLI**: `supabase db push` if you wire up the local CLI + project ref.

After the tables exist, regenerate app types:
`npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts`

## Design decisions baked in (flag if you disagree)

- **`profiles` are readable by any authenticated user** — sellers' names/programs
  are shown to buyers. All other tables are private to the owner/participants.
- **No `CHECK` on `listings.category`** — the canonical list now lives in
  `src/constants/categories.ts` (`LISTING_CATEGORIES`) and is enforced at the app
  level. Left as free text in the DB for flexibility (adding a category shouldn't
  require a migration); add a `CHECK` here later if you want DB-level enforcement.
- **`condition` is nullable** with a `CHECK` for `'Like new' | 'Good' | 'Fair'`
  so free/trade items can omit it.
- **`notifications` insert policy is a placeholder** (owner-scoped). Real
  notification creation likely happens via triggers/service-role — revisit when
  that flow is designed.
- **`profiles.verified` is retained** to match the `SellerProfile` type, but the
  "Western verified" UI was removed (commit 013c3d8) — currently unused.

## Not included on purpose

- No auto-create-profile trigger on signup. The onboarding flow is meant to
  insert the profile explicitly (via `ProfileRepository.upsert`). If you'd rather
  auto-create a stub profile on `auth.users` insert, that's a one-trigger add —
  say the word.
- Buckets are created `public` so `getPublicUrl()` works unauthenticated (that
  route bypasses RLS entirely). The `select` policy on `storage.objects` is a
  separate concern — it only gates `list()`/authenticated `download()` — and
  is scoped `to authenticated`, like every other policy in this project, so a
  signed-out caller can't enumerate bucket contents even though a known public
  URL still resolves for anyone.
- `file_size_limit` (5 MB listing-images, 2 MB avatars) and `allowed_mime_types`
  (`image/jpeg`, `image/png`, `image/webp`) are enforced at the bucket level as
  a baseline guardrail against arbitrarily large or non-image uploads, ahead of
  the real compression/validation pipeline (AX-401).
- No update policy on either bucket — a replaced image/avatar is a delete +
  insert client-side, not an in-place overwrite.
- `StorageRepository.uploadListingImages`, compression, upload progress, and
  the avatar upload UI are separate (AX-401 / AX-403) — this migration is only
  the bucket + policy layer.
