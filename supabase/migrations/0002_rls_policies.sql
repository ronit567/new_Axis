-- Axis — Phase 2 RLS policies (DRAFT — review before applying)
-- Assumes 0001_initial_schema.sql has run (RLS already enabled per table).
--
-- Principles:
--   * Public marketplace data (profiles + *active* listings) is readable by
--     anyone, signed in or not (anon + authenticated).
--   * Private rows (saved, messages, notifications, blocks) are readable and
--     writable only by their owner/participants.
--   * Only the owner can mutate their own profile/listing.
--   * Blocked relationships are enforced here, at the query layer, so a block
--     hides content even if the app forgets to filter (defense in depth).
--
-- Policy tests live in supabase/tests/rls_policies_test.sql (owner vs
-- non-owner vs anon vs blocked).

-- ---------------------------------------------------------------------------
-- is_blocked(a, b): true if a and b have blocked each other in *either*
-- direction. SECURITY DEFINER so it can read the whole blocks table regardless
-- of the caller's RLS (a user must be able to tell that someone blocked *them*,
-- which the blocks_select_own policy alone would not reveal). STABLE + a pinned
-- search_path per Supabase's SECURITY DEFINER guidance.
--
-- EXECUTE is granted to `authenticated` only. anon never legitimately needs
-- it (listings_select_public short-circuits on auth.uid() is null via a CASE
-- before it would call this), and PostgREST exposes any EXECUTE-granted
-- function as a callable RPC — granting it to anon would let an unauthed
-- caller probe `is_blocked(a, b)` directly and learn block relationships
-- that bypass RLS on the blocks table.
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked(a uuid, b uuid)
  returns boolean
  language sql
  security definer
  set search_path = public
  stable
as $$
  select exists (
    select 1
    from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: public seller info — readable by anyone (needed to render listing
-- cards and seller pages, including for signed-out browsing). Writable only by
-- the owner.
--
-- PRIVACY NOTE: this exposes student names/programs to fully anonymous callers.
-- The ticket AC requires anon read of public listings, and listings show seller
-- info, so profiles are anon-readable too. To lock browsing behind auth instead,
-- change `to anon, authenticated` -> `to authenticated` on the two _select_
-- policies below (profiles + listings).
-- ---------------------------------------------------------------------------
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- listings: active listings are browsable by anyone; the seller additionally
-- sees their own listings in any status (e.g. 'sold' in ManageListings).
-- Blocked relationships are hidden in both directions for signed-in viewers.
-- Only the seller mutates.
--
-- Predicate reads as: own listing, OR (active AND not blocked-with-seller).
-- The not-blocked check uses CASE rather than `auth.uid() is null or
-- not is_blocked(...)`: Postgres does not guarantee left-to-right
-- short-circuiting of OR, but CASE WHEN/THEN *is* guaranteed to evaluate in
-- order, so anon callers (auth.uid() is null) never actually invoke
-- is_blocked() — which matters now that anon has no EXECUTE grant on it.
-- ---------------------------------------------------------------------------
create policy "listings_select_public"
  on public.listings for select
  to anon, authenticated
  using (
    auth.uid() = seller_id
    or (
      status = 'active'
      and case
            when auth.uid() is null then true
            else not public.is_blocked(auth.uid(), seller_id)
          end
    )
  );

create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (auth.uid() = seller_id);

create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "listings_delete_own"
  on public.listings for delete
  to authenticated
  using (auth.uid() = seller_id);

-- ---------------------------------------------------------------------------
-- saved_listings: fully private to the owning user.
-- ---------------------------------------------------------------------------
create policy "saved_select_own"
  on public.saved_listings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_insert_own"
  on public.saved_listings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_delete_own"
  on public.saved_listings for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- messages: visible to the two participants regardless of a later block —
-- blocking stops new contact, not access to a conversation you already had
-- (e.g. a pickup arrangement one side may still need to reference). Only the
-- sender can write, and cannot message across a block. Deletes are the
-- sender's own.
-- ---------------------------------------------------------------------------
create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and not public.is_blocked(sender_id, receiver_id)
  );

create policy "messages_delete_sender"
  on public.messages for delete
  to authenticated
  using (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- notifications: private to the recipient.
-- NOTE: inserts are scoped to the owner as a placeholder. In practice
-- notifications are usually created by DB triggers / service-role code on
-- behalf of another user — revisit when notification generation is designed
-- (AX-601/602).
-- ---------------------------------------------------------------------------
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "notifications_insert_own"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- blocks: a user manages only their own outgoing blocks. Reads are limited to
-- rows you created (you can list who *you* blocked, not who blocked you — that
-- asymmetry is intentional; is_blocked() enforces the reverse direction).
-- ---------------------------------------------------------------------------
create policy "blocks_select_own"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "blocks_insert_own"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

create policy "blocks_delete_own"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);
