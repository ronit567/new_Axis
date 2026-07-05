# Supabase — schema drafts

**Status: DRAFT.** These files are prepared ahead of Phase 2 so they can be
applied quickly once the Supabase project exists. Nothing here has been run
against a live database yet — review before applying.

## Files

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Tables (`profiles`, `listings`, `saved_listings`, `messages`, `notifications`, `blocks`), indexes, and `enable row level security` on each. |
| `migrations/0002_rls_policies.sql` | RLS policies + the `is_blocked()` helper. Apply **after** 0001. |
| `migrations/0003_storage_buckets.sql` | `listing-images` + `avatars` Storage buckets (with size/mime-type limits) and their `storage.objects` policies (authenticated upload to own prefix, public URL read via the bucket's `public` flag, owner-only delete). |
| `tests/rls_policies_test.sql` | Owner-vs-non-owner-vs-anon-vs-blocked policy tests. Run **after** 0001+0002. |
| `health_check.sql` | Throwaway table for the Milestone 5 smoke test. Drop it after. |

## How to apply (once Supabase is connected)

- **Via the Supabase MCP server** (preferred): run `0001`, `0002`, `0003`, then
  `health_check.sql`. I can drive this directly once the MCP is connected.
- **Via the dashboard**: paste each file into the SQL editor in order.
- **Via the CLI**: `supabase db push` if you wire up the local CLI + project ref.

After applying, run `tests/rls_policies_test.sql` (SQL editor or psql). It runs
inside a transaction and `rollback`s, so it leaves nothing behind; it raises on
the first failed assertion and prints `ALL RLS TESTS PASSED` on success.

After the tables exist, regenerate app types:
`npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts`

## Design decisions baked in (flag if you disagree)

- **Public read is `anon` + `authenticated`** — active listings and profiles are
  readable even signed-out (the ticket AC: "anonymous/authed users can read
  public/active listings"). Only `status = 'active'` listings are public; a seller
  additionally sees their own listings in any status (e.g. `sold` in
  ManageListings). ⚠️ This exposes student names/programs to anonymous callers —
  to require sign-in instead, change `to anon, authenticated` → `to authenticated`
  on the `profiles_select_public` and `listings_select_public` policies. All other
  tables are private to the owner/participants.
- **Blocks are enforced at the query layer.** `public.blocks` is a directed table
  (`blocker_id` blocked `blocked_id`), but `is_blocked(a, b)` treats it as
  **mutual** for visibility: a block hides each user's listings and profile from
  the other, and prevents *new* messages in either direction. Existing message
  history between the two stays readable to both — blocking stops new contact,
  it doesn't erase a conversation either side may still need (e.g. a pickup
  arrangement) — though since profiles are also hidden, that preserved thread
  will render without a name/avatar for the now-blocked party.
  `is_blocked()` is `SECURITY DEFINER` so it can see the reverse direction (you
  can't `select` rows where someone blocked you, but the policy still needs to
  honor them), and `EXECUTE` is granted to `authenticated` only — anon never
  needs it, and granting it would let PostgREST expose it as a callable RPC that
  lets an unauthenticated caller probe block relationships directly. It also
  requires the caller to be one of the two parties passed in — otherwise it
  returns `false` unconditionally — so an authenticated user can't call
  `is_blocked(userB, userC)` for two *other* arbitrary users and learn their
  block relationship. This is the enforcement layer; the ReportModal UI wiring
  is AX-703.
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
  is scoped `to authenticated` rather than `to anon, authenticated` like
  `profiles_select_public`/`listings_select_public` (0002). That's deliberate,
  not an oversight: a signed-out browser still resolves any known public image
  URL either way (bucket-flag-driven, not policy-driven), but `to authenticated`
  additionally stops an anonymous caller from `list()`-enumerating bucket
  contents. Revisit if anon `list()`/authenticated-`download()` turns out to be
  needed for parity with the anon-browsable listings/profiles.
- `file_size_limit` (5 MB listing-images, 2 MB avatars) and `allowed_mime_types`
  (`image/jpeg`, `image/png`, `image/webp`) are enforced at the bucket level as
  a baseline guardrail against arbitrarily large or non-image uploads, ahead of
  the real compression/validation pipeline (AX-401).
- No update policy on either bucket — a replaced image/avatar is a delete +
  insert client-side, not an in-place overwrite.
- `StorageRepository.uploadListingImages`, compression, upload progress, and
  the avatar upload UI are separate (AX-401 / AX-403) — this migration is only
  the bucket + policy layer.
