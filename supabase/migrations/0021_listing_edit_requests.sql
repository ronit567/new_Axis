-- Axis — 0021: listing edit review flow.
--
-- There is NO listing_images table — photos live entirely in
-- listings.image_urls text[] (0001), with the storage objects themselves at
-- {seller_id}/{listing_id}/{i}.{ext} in the public listing-images bucket
-- (0014). "Editing photos" always means replacing the whole image_urls array.
--
-- Problem: once a listing has been saved or messaged about, the fields a scam
-- listing would abuse to bait-and-switch a buyer (title, category, condition,
-- photos) shouldn't be silently swappable by the seller after the fact. Price
-- and description are cheap to renegotiate over chat and stay freely
-- editable. This migration adds:
--   1. is_listing_engaged() — a SECURITY DEFINER predicate the app calls to
--      decide (client-side, UX only) whether a listing has outside interest.
--   2. listing_edit_requests — a moderation-style queue for proposed changes
--      to the guarded fields on an engaged listing.
--   3. A BEFORE UPDATE trigger on listings that is the actual authority: it
--      rejects a direct update to a guarded field on an engaged listing,
--      regardless of what the client believed when it chose its code path.
--   4. Notification fan-out to savers when price/description changes.
--   5. apply_listing_edit() — service_role-only RPC that promotes an approved
--      edit request into the real listings row.
--
-- Numbered 0021: 0019/0020 are taken by an open PR (follows/reviews) already
-- in flight against this branch's base.

-- ---------------------------------------------------------------------------
-- 1. is_listing_engaged(p_listing_id): true only for the CALLER'S OWN listing,
-- and only once someone other than the seller has saved it or messaged about
-- it. SECURITY DEFINER so it can see saved_listings/messages rows the caller
-- (a seller checking their own listing) could not otherwise read under RLS —
-- saved_select_own and messages_select_participant both scope to the row's
-- own user, not "does anyone have a save/message on listing X". Same
-- owner-party guard as is_blocked() (0002) / my_listing_save_counts() (0006):
-- the `l.seller_id = auth.uid()` clause means this can never be used to probe
-- whether *someone else's* listing has outside interest. STABLE + pinned
-- search_path per Supabase's SECURITY DEFINER guidance.
-- ---------------------------------------------------------------------------
create or replace function public.is_listing_engaged(p_listing_id uuid)
  returns boolean
  language sql
  security definer
  set search_path = public
  stable
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and l.seller_id = auth.uid()
      and (
        exists (
          select 1
          from public.saved_listings sl
          where sl.listing_id = l.id
            and sl.user_id <> l.seller_id
        )
        or exists (
          select 1
          from public.messages m
          where m.listing_id = l.id
            and m.sender_id <> l.seller_id
        )
      )
  );
$$;

revoke all on function public.is_listing_engaged(uuid) from public;
grant execute on function public.is_listing_engaged(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. listing_edit_requests: a pending proposal to change one or more of the
-- guarded fields on an engaged listing. NULL on a proposed_* column means
-- "leave this field unchanged" — proposed_image_urls, when set, is the
-- COMPLETE desired ordered array (not a delta), same convention as
-- listings.image_urls itself.
-- ---------------------------------------------------------------------------
create table if not exists public.listing_edit_requests (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references public.listings (id) on delete cascade,
  requester_id          uuid not null references public.profiles (id) on delete cascade,
  proposed_title        text,
  proposed_category     text,
  proposed_condition    text check (proposed_condition in ('Like new', 'Good', 'Fair')),
  proposed_image_urls   text[],
  -- Moderation queue state, same shape as reports.status (0011): no client
  -- policy below ever updates this — a request moves to approved/rejected via
  -- apply_listing_edit() (service_role), which is the only writer.
  status                text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at            timestamptz not null default now(),
  reviewed_at           timestamptz,
  constraint ler_has_a_change check (
    proposed_title is not null
    or proposed_category is not null
    or proposed_condition is not null
    or proposed_image_urls is not null
  )
);

-- Partial index: the only lookup the app ever does is "does this listing have
-- a pending request right now" (ListingEditRequestRepository.getPending), so
-- index just the pending rows rather than the whole table.
create index if not exists listing_edit_requests_pending_idx
  on public.listing_edit_requests (listing_id)
  where status = 'pending';

create index if not exists listing_edit_requests_requester_id_idx
  on public.listing_edit_requests (requester_id);

alter table public.listing_edit_requests enable row level security;

-- A requester (always the listing's own seller — enforced below) can file a
-- request and see their own request history. No update/delete policy exists:
-- moderation/approval happens off the RLS surface via apply_listing_edit(),
-- same pattern as reports.status (0011).
create policy "listing_edit_requests_insert_own"
  on public.listing_edit_requests for insert
  to authenticated
  with check (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  );

create policy "listing_edit_requests_select_own"
  on public.listing_edit_requests for select
  to authenticated
  using (auth.uid() = requester_id);

grant select, insert on public.listing_edit_requests to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Scam-vector guard: the CLIENT'S is_listing_engaged() check (above) is
-- UX-only — it lets the app choose a direct update vs. filing an edit
-- request, but a racing client (stale "not engaged yet" read) must not be
-- able to bypass review just by hitting the update() path anyway. This
-- trigger is the real authority: it re-checks engagement server-side on
-- every listings UPDATE and rejects the write outright if a guarded field
-- actually changed on an engaged listing, no matter which path the client
-- took.
--
-- axis.bypass_edit_guard is a transaction-local escape hatch for
-- apply_listing_edit() (part 5): once a request has been through the review
-- queue, its promotion into the real row must not re-trip this same guard.
--
-- Verified interplay with existing writers: increment_listing_views (0007)
-- only touches views; markSold/relist (ListingRepository) only touch status;
-- a low-risk edit patch (price/description/is_free/is_trade/pickup) never
-- touches title/category/condition/image_urls — so none of those trip this
-- trigger.
-- ---------------------------------------------------------------------------
create or replace function public.guard_engaged_listing_edit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if current_setting('axis.bypass_edit_guard', true) = 'on' then
    return new;
  end if;

  if (
    new.title is distinct from old.title
    or new.category is distinct from old.category
    or new.condition is distinct from old.condition
    or new.image_urls is distinct from old.image_urls
  ) and public.is_listing_engaged(old.id) then
    raise exception 'listing_edit_requires_review' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_engaged_listing_edit on public.listings;
create trigger trg_guard_engaged_listing_edit
  before update on public.listings
  for each row execute function public.guard_engaged_listing_edit();

-- ---------------------------------------------------------------------------
-- 4. Notification fan-out: widen the type check (0013) to admit
-- 'listing_edited', then notify every saver (never the seller themself) when
-- the low-risk price/description/pickup fields change on a listing they
-- saved — a saver who already agreed on a meetup spot should hear if it
-- moves, same as a price change. Savers-only audience is a deliberate v1
-- scope — buyers mid-conversation already see the listing snapshot resurface
-- in chat.
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('message', 'listing_saved', 'listing_edited'));

-- SECURITY DEFINER so it can write a row owned by each saver even though the
-- UPDATE was performed by the seller. Dedup: one unread 'listing_edited'
-- notification per (saver, listing) — repeated price tweaks collapse to a
-- single entry, same dedup shape as notify_on_message/notify_on_saved_listing
-- (0013).
create or replace function public.notify_on_listing_edit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.price is distinct from old.price
    or new.description is distinct from old.description
    or new.pickup is distinct from old.pickup
  then
    insert into public.notifications (user_id, type, actor_id, listing_id)
    select sl.user_id, 'listing_edited', new.seller_id, new.id
    from public.saved_listings sl
    where sl.listing_id = new.id
      and sl.user_id <> new.seller_id
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = sl.user_id
          and n.type = 'listing_edited'
          and n.listing_id = new.id
          and n.read = false
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_listing_edit on public.listings;
create trigger trg_notify_on_listing_edit
  after update on public.listings
  for each row execute function public.notify_on_listing_edit();

-- ---------------------------------------------------------------------------
-- 5. apply_listing_edit(p_edit_id): promotes an approved edit request into
-- the real listings row. service_role only (revoked below) — there is no
-- in-app moderation UI yet, so this is driven from the Supabase dashboard /
-- a future admin surface, same posture as reports.status (0011).
--
-- Orphaned storage objects (an approved photo edit that dropped a previously
-- live URL) are swept by a separate GC pass, not here — matches the existing
-- note on ListingRepository.deleteListing about storage cleanup being a
-- separate concern from the row mutation.
-- ---------------------------------------------------------------------------
create or replace function public.apply_listing_edit(p_edit_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r public.listing_edit_requests%rowtype;
begin
  select * into r
  from public.listing_edit_requests
  where id = p_edit_id and status = 'pending';

  if not found then
    raise exception 'no pending listing edit request: %', p_edit_id;
  end if;

  -- Transaction-local: this promotion is the one write that must not re-trip
  -- guard_engaged_listing_edit() now that the change has actually been
  -- reviewed. Scoped `true` (is_local) means it resets at the end of this
  -- transaction rather than leaking into any other session.
  perform set_config('axis.bypass_edit_guard', 'on', true);

  update public.listings
  set title       = coalesce(r.proposed_title, title),
      category    = coalesce(r.proposed_category, category),
      condition   = coalesce(r.proposed_condition, condition),
      image_urls  = coalesce(r.proposed_image_urls, image_urls)
  where id = r.listing_id;

  update public.listing_edit_requests
  set status = 'approved', reviewed_at = now()
  where id = r.id;
end;
$$;

revoke all on function public.apply_listing_edit(uuid) from public, anon, authenticated;
