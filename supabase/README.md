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
| `migrations/0006_saved_listing_counts.sql` | `my_listing_save_counts()` — a `SECURITY DEFINER` RPC, scoped to the caller's own listings, that aggregates `saved_listings` across users (a direct table query is RLS-scoped to the caller's own save row, so it can't produce a real count). |
| `migrations/0007_increment_listing_views.sql` | `increment_listing_views()` — a `SECURITY DEFINER` RPC that atomically bumps a listing's view counter for any authenticated viewer *except the owner* (RLS scopes plain UPDATEs to the seller, which would leave views frozen for real browsers; the owner exclusion stops self-inflation). |
| `migrations/0008_messages_read_receipts.sql` | `messages.read_at` (receiver-only update via column grant), the unread partial index, and adds `messages` to the Realtime publication. |
| `migrations/0009_conversation_list_view.sql` | `conversation_list` view (`security_invoker`): one row per (listing, partner) thread — last message + unread count — for the caller. Backs the Messages inbox. Apply **after** 0008. |
| `migrations/0010_delete_account.sql` | `delete_own_account()` — a `SECURITY DEFINER` RPC that deletes the caller's `auth.users` row; every owned row (`profiles`, `listings`, `saved_listings`, `messages`, `notifications`, `blocks`) cascades away in the same statement via the `on delete cascade` FKs already in 0001. Backs AX-704 (Settings → Danger zone → Delete account). |
| `migrations/0011_reports.sql` | `reports` table (reporter, target user/listing, reason, status) + RLS: reporter can file and read back their own reports; nobody else can. Backs the ReportModal submit flow (AX-703). |
| `tests/rls_policies_test.sql` | Owner-vs-non-owner-vs-anon-vs-blocked policy tests for the table RLS (0001+0002), the storage.objects policies (0003), **and** `my_listing_save_counts()` scoping (0006). Run **after** 0001+0002+0003+0006. |
| `tests/messages_read_receipts_test.sql` | Read-receipt + `conversation_list` policy tests (receiver-only `read_at` writes, column-grant immutability, unread counts). Run **after** 0008+0009. |
| `tests/delete_account_test.sql` | `delete_own_account()` tests: anon has no EXECUTE grant, the caller's full cascade graph (profile/listing/saved_listing/messages-both-directions/notification/blocks) is gone, an unrelated user's rows are untouched, and calling it again post-delete is a no-op. Run **after** 0010. |
| `tests/reports_test.sql` | Reports policy tests (reporter can file + read own, cross-user select/insert denied, anon denied, `reports_target_present` constraint enforced). Run **after** 0011. |
| `health_check.sql` | Throwaway table for the Milestone 5 smoke test. Drop it after. |

## How to apply (once Supabase is connected)

- **Via the Supabase MCP server** (preferred): run `0001`, `0002`, `0003`, `0006`,
  `0007`, `0008`, `0009`, `0010`, `0011`, then `health_check.sql`. I can drive this
  directly once the MCP is connected.
- **Via the dashboard**: paste each file into the SQL editor in order.
- **Via the CLI**: `supabase db push` if you wire up the local CLI + project ref.

After applying (0001+0002+0003), run `tests/rls_policies_test.sql` (SQL editor
or psql). It runs inside a transaction and `rollback`s, so it leaves nothing
behind; it raises on the first failed assertion and prints `ALL RLS TESTS
PASSED` on success. The storage scenarios (6–9) need the buckets from 0003 to
exist, so apply 0003 before running the tests. After applying 0010, run
`tests/delete_account_test.sql`; after applying 0011, run `tests/reports_test.sql`
the same way.

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
- **Account deletion is a hard delete, not an anonymized tombstone** —
  `delete_own_account()` (0010) deletes `auth.users` and lets the existing
  cascades remove everything reachable from it, *including* a shared message
  thread where the deleted user was the sender or receiver (the row has no
  per-party copy, so it's one delete for both sides). This is a deliberate
  narrower choice than "preserve the other party's copy, anonymize the
  sender" (the pattern this file already uses for *blocking*, where the
  thread survives and just loses the name/avatar) — doing that for deletion
  would require dropping the `profiles.id → auth.users.id` cascade FK and
  adding a `deleted_at` tombstone column so a profile can outlive its auth
  user, which is a real schema/architecture change, not a follow-on of this
  ticket. AX-704's AC is "deleting an account removes the user and their
  listings/messages" — this matches that literally. Revisit if the product
  wants counterparty history preserved.
- **`reports` is a queue, not a full moderation system.** `status` moves
  `open → reviewing → resolved/dismissed`, but nothing in this migration moves
  it — there's no admin UI or role yet, so the queue is reviewed by hand via
  the Supabase dashboard (`service_role` bypasses RLS entirely) by the team at
  `support@axis.app` (the contact already published on `TermsOfServiceScreen`).
  Revisit once there's real moderator tooling.

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
