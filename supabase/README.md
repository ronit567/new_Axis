# Supabase — schema drafts

**Status: DRAFT.** These files are prepared ahead of Phase 2 so they can be
applied quickly once the Supabase project exists. Nothing here has been run
against a live database yet — review before applying.

## Files

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Tables (`profiles`, `listings`, `saved_listings`, `messages`, `notifications`, `blocks`), indexes, and `enable row level security` on each. |
| `migrations/0002_rls_policies.sql` | RLS policies + the `is_blocked()` helper. Apply **after** 0001. |
| `tests/rls_policies_test.sql` | Owner-vs-non-owner-vs-anon-vs-blocked policy tests. Run **after** 0001+0002. |
| `health_check.sql` | Throwaway table for the Milestone 5 smoke test. Drop it after. |

## How to apply (once Supabase is connected)

- **Via the Supabase MCP server** (preferred): run `0001` then `0002`, then
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
  lets an unauthenticated caller probe block relationships directly. This is the
  enforcement layer; the ReportModal UI wiring is AX-703.
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
- No Storage bucket for listing images yet (Phase 2, item 6).
