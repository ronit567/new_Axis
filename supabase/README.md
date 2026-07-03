# Supabase — schema drafts

**Status: DRAFT.** These files are prepared ahead of Phase 2 so they can be
applied quickly once the Supabase project exists. Nothing here has been run
against a live database yet — review before applying.

## Files

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Tables (`profiles`, `listings`, `saved_listings`, `messages`, `notifications`), indexes, and `enable row level security` on each. |
| `migrations/0002_rls_policies.sql` | RLS policies. Apply **after** 0001. |
| `health_check.sql` | Throwaway table for the Milestone 5 smoke test. Drop it after. |

## How to apply (once Supabase is connected)

- **Via the Supabase MCP server** (preferred): run `0001` then `0002`, then
  `health_check.sql`. I can drive this directly once the MCP is connected.
- **Via the dashboard**: paste each file into the SQL editor in order.
- **Via the CLI**: `supabase db push` if you wire up the local CLI + project ref.

After the tables exist, regenerate app types:
`npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts`

## Design decisions baked in (flag if you disagree)

- **`profiles` are readable by any authenticated user** — sellers' names/programs
  are shown to buyers. All other tables are private to the owner/participants.
- **No `CHECK` on `listings.category`** — the canonical category list is still an
  open decision (Home browse vs CreateListing mismatch; see AI_context Known
  Issues). Left as free text until that's resolved.
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
