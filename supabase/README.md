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
| `migrations/0005_messages_read_receipts.sql` | `messages.read_at` (receiver-only update via column grant), the unread partial index, and adds `messages` to the Realtime publication. |
| `migrations/0006_conversation_list_view.sql` | `conversation_list` view (`security_invoker`): one row per (listing, partner) thread — last message + unread count — for the caller. Backs the Messages inbox. Apply **after** 0005. |
| `tests/rls_policies_test.sql` | Owner-vs-non-owner-vs-anon-vs-blocked policy tests for the table RLS (0001+0002) **and** the storage.objects policies (0003). Run **after** 0001+0002+0003. |
| `health_check.sql` | Throwaway table for the Milestone 5 smoke test. Drop it after. |

## How to apply (once Supabase is connected)

- **Via the Supabase MCP server** (preferred): run `0001`, `0002`, `0003`, then
  `health_check.sql`. I can drive this directly once the MCP is connected.
- **Via the dashboard**: paste each file into the SQL editor in order.
- **Via the CLI**: `supabase db push` if you wire up the local CLI + project ref.

After applying (0001+0002+0003), run `tests/rls_policies_test.sql` (SQL editor
or psql). It runs inside a transaction and `rollback`s, so it leaves nothing
behind; it raises on the first failed assertion and prints `ALL RLS TESTS
PASSED` on success. The storage scenarios (6–9) need the buckets from 0003 to
exist, so apply 0003 before running the tests.

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
- **Storage "public read" is served by the bucket's `public = true` flag, not
  by an RLS policy.** `getPublicUrl()` uses the `/object/public/` route, which
  bypasses RLS, so anyone with a stored image URL can render it while signed
  out (that's the "public read" the ticket asks for). The `select` policy on
  `storage.objects` is a separate concern — it only governs the RLS-gated
  paths (`list()` and authenticated `download()`) — and is scoped **owner-only**
  (same `(storage.foldername(name))[1] = auth.uid()::text` predicate as
  insert/delete), *not* broadly `to authenticated`. This stops any signed-in
  user from `list()`-enumerating the whole bucket and harvesting every
  seller_id / listing_id present; owners can still list their own uploads.
- `file_size_limit` (5 MB listing-images, 2 MB avatars) and `allowed_mime_types`
  (`image/jpeg`, `image/png`, `image/webp`) are enforced at the bucket level as
  a baseline guardrail against arbitrarily large or non-image uploads, ahead of
  the real compression/validation pipeline (AX-401).
- No update policy on either bucket — a replaced image/avatar is a delete +
  insert client-side, not an in-place overwrite.
- Storage policies are covered by `tests/rls_policies_test.sql` (scenarios 6–9):
  owner-prefix upload allowed / cross-prefix upload rejected, owner-scoped
  select (no cross-user enumeration), owner-only delete, and anon locked out of
  the RLS-gated paths.
- `StorageRepository.uploadListingImages`, compression, upload progress, and
  the avatar upload UI are separate (AX-401 / AX-403) — this migration is only
  the bucket + policy layer.
