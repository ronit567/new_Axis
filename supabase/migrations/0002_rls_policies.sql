-- Axis — Phase 2 RLS policies (DRAFT — review before applying)
-- Assumes 0001_initial_schema.sql has run (RLS already enabled per table).
-- Principle: authenticated users can browse public marketplace data (profiles,
-- listings) but can only write/read their own private rows.

-- ---------------------------------------------------------------------------
-- profiles: readable by any authenticated user (seller info is shown to
-- buyers); writable only by the owner.
-- ---------------------------------------------------------------------------
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
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
-- listings: browsable by any authenticated user; only the seller can mutate.
-- ---------------------------------------------------------------------------
create policy "listings_select_authenticated"
  on public.listings for select
  to authenticated
  using (true);

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
-- messages: visible only to the two participants; only the sender can write.
-- ---------------------------------------------------------------------------
create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

create policy "messages_delete_sender"
  on public.messages for delete
  to authenticated
  using (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- notifications: private to the recipient.
-- NOTE: inserts are scoped to the owner as a placeholder. In practice
-- notifications are usually created by DB triggers / service-role code on
-- behalf of another user — revisit when notification generation is designed.
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
