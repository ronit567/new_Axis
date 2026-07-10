-- Axis — 0020: seller reviews (the AX-702 reviews table).
--
-- Written reviews with a 1–5 star rating, rendered on SellerProfile and the
-- own Profile tab. One review per (seller, reviewer): writing again edits your
-- existing review (the repository does select-then-update/insert — see the
-- column-grant note below for why not a single upsert). Screens aggregate
-- rating/count live from these rows; the profile mappers keep returning 0 so
-- there is no denormalized counter to drift.

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now(),
  unique (seller_id, reviewer_id),
  constraint reviews_no_self check (seller_id <> reviewer_id)
);

-- List query: a seller's reviews, newest first.
create index if not exists reviews_seller_created_idx
  on public.reviews (seller_id, created_at desc);

alter table public.reviews enable row level security;

-- Readable by any signed-in user, except the viewer never sees a review
-- written by someone they're blocked with (their content stays hidden, same
-- spirit as profiles_select_public). A blocked *seller's* reviews need no
-- check here: their whole profile page is already RLS-hidden, and the
-- participant short-circuit keeps is_blocked()'s caller-is-a-party
-- precondition satisfied for third-party readers.
create policy "reviews_select_authenticated"
  on public.reviews for select
  to authenticated
  using (
    auth.uid() = reviewer_id
    or auth.uid() = seller_id
    or not public.is_blocked(auth.uid(), reviewer_id)
  );

-- Only review someone you've actually talked to on Axis: the EXISTS gate
-- requires a message in either direction with the seller. It runs with
-- invoker rights, and messages_select_participant (0002) shows the caller
-- exactly their own conversations, so the subquery sees precisely what it
-- needs. Also: write as yourself, never about yourself, never across a block.
create policy "reviews_insert_reviewer"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = reviewer_id
    and reviewer_id <> seller_id
    and not public.is_blocked(reviewer_id, seller_id)
    and exists (
      select 1 from public.messages m
      where (m.sender_id = auth.uid() and m.receiver_id = seller_id)
         or (m.sender_id = seller_id and m.receiver_id = auth.uid())
    )
  );

create policy "reviews_update_reviewer"
  on public.reviews for update
  to authenticated
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);

create policy "reviews_delete_reviewer"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = reviewer_id);

-- Grants (0005 pattern). UPDATE is column-restricted to (rating, body) — same
-- shape as messages.read_at (0008): without it, a reviewer could UPDATE
-- seller_id and "move" their review onto a seller they never messaged,
-- side-stepping the INSERT policy's chat gate. This is also why the
-- repository can't use a PostgREST upsert: ON CONFLICT DO UPDATE would try to
-- set the identity columns too and hit this grant.
grant select, insert, delete on public.reviews to authenticated;
grant update (rating, body) on public.reviews to authenticated;
