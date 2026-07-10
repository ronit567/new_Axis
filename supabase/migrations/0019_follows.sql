-- Axis — 0019: follows (persisted profile follows).
--
-- SellerProfileScreen's "Follow" button was UI-only local state; this gives it
-- a table so follows survive the session and the own-profile "Following" list
-- can read them back. One row per (follower, followee); follow/unfollow is
-- insert/delete, so there is no update policy or grant.

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

-- Same asymmetry as blocks (0002): you can list who *you* follow, not who
-- follows you. Follower counts for a profile are a later aggregate concern
-- (the AX-702-style RPC), not a reason to widen row visibility now.
create policy "follows_select_own"
  on public.follows for select
  to authenticated
  using (auth.uid() = follower_id);

-- No following across a block in either direction, mirroring
-- messages_insert_sender (0002).
create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check (
    auth.uid() = follower_id
    and not public.is_blocked(follower_id, followee_id)
  );

create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- Table privilege (0005 pattern): RLS filters rows, but the role still needs
-- the base grant to touch the table at all.
grant select, insert, delete on public.follows to authenticated;
