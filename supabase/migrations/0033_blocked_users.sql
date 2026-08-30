-- Axis — 0033: list your own blocks, with display info (Blocked users screen).
--
-- Blocking has existed since 0001/0002, but nothing let a user SEE or undo
-- their blocks — the Settings "Blocked users" row was dead UI. The delete side
-- needs no schema work (blocks_delete_own already exists in 0002); the read
-- side does, because of a deliberate RLS interaction: profiles_select hides
-- profiles across a block in BOTH directions, so a plain
--   blocks join profiles
-- from the client returns the blocker's own rows with every profile column
-- NULLed out — a list of blocked users with no names.
--
-- SECURITY DEFINER threads that needle: the function reads profiles past RLS,
-- but only ever for rows where blocker_id = auth.uid(), so a caller learns
-- exactly the display info for people they themselves blocked — information
-- they had when they pressed Block. A null auth.uid() matches nothing.
create or replace function public.my_blocked_users()
  returns table (
    blocked_id   uuid,
    name         text,
    initials     text,
    avatar_url   text,
    avatar_color text,
    blocked_at   timestamptz
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select b.blocked_id, p.name, p.initials, p.avatar_url, p.avatar_color, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.my_blocked_users() from public, anon;
grant execute on function public.my_blocked_users() to authenticated;
