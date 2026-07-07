-- Axis — reports table (AX-703). Backs the ReportModal UI (listing/user/chat
-- reports) with a real, queryable moderation queue. Blocking already has its
-- own table + is_blocked() RLS from 0001/0002 — that mechanism is untouched
-- here; this migration only adds reporting. Wiring the Block button to
-- public.blocks (instead of the UI's current local useState) is app-layer
-- (BlockRepository), no schema change needed for it.
--
-- Numbered 0011: 0001-0010 are taken by prior migrations already on main
-- (0010 is AX-704's delete_own_account, merged after this branch started).

create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null references public.profiles (id) on delete cascade,
  -- Mirrors ReportTarget (src/types/index.ts) — the three ReportModal entry
  -- points (listing detail, seller profile, chat).
  target_type        text not null check (target_type in ('user', 'listing', 'chat')),
  -- At least one of these two is set (enforced below). A 'listing' report
  -- carries both (the listing and its seller, for a moderator to act on
  -- either without an extra join); a 'user'/'chat' report carries just the
  -- user.
  target_user_id     uuid references public.profiles (id) on delete cascade,
  target_listing_id  uuid references public.listings (id) on delete cascade,
  -- Mirrors ReportReason / the REASONS list in src/components/ReportModal.tsx.
  reason             text not null check (reason in ('spam', 'prohibited_item', 'harassment', 'other')),
  -- Moderation queue state. No client policy below ever updates this — status
  -- moves forward via the Supabase dashboard / service_role (reports are
  -- reviewed at support@axis.app, per TermsOfServiceScreen's existing contact),
  -- which bypasses RLS entirely. There is no in-app moderation UI yet.
  status             text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at         timestamptz not null default now(),
  constraint reports_target_present check (target_user_id is not null or target_listing_id is not null)
);

create index if not exists reports_reporter_id_idx      on public.reports (reporter_id);
create index if not exists reports_status_idx            on public.reports (status);
create index if not exists reports_target_user_id_idx    on public.reports (target_user_id);
create index if not exists reports_target_listing_id_idx on public.reports (target_listing_id);

alter table public.reports enable row level security;

-- A reporter can file reports and see their own report history. Nobody can
-- read someone else's filed report (that would leak who reported them), and
-- nobody can edit/withdraw a report or touch `status` from the client —
-- moderation happens off the RLS surface entirely, via service_role.
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);
