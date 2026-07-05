-- Axis — base table privileges for the API roles.
--
-- RLS policies (0002) only *filter rows*; a role still needs table-level
-- GRANTs to touch a table at all. Older Supabase projects auto-granted ALL on
-- new public tables to anon/authenticated via default privileges, but this
-- project's fresh instance does not (first seen as `42501 permission denied
-- for table listings` when running the RLS tests). Grant explicitly, scoped
-- to exactly the commands the 0002 policies allow — no broader.
--
-- Idempotent: GRANT is a no-op if the privilege already exists.

grant usage on schema public to anon, authenticated;

-- profiles: public read (anon browses listings/sellers), owner-only writes.
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- listings: public read of active rows, seller-only mutations.
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

-- saved_listings: private to the owner; no update policy exists (save/unsave
-- is insert/delete), so no update grant.
grant select, insert, delete on public.saved_listings to authenticated;

-- messages: participants read, sender inserts/deletes; no update policy.
grant select, insert, delete on public.messages to authenticated;

-- notifications: owner-scoped read/insert/update(read-flag)/delete.
grant select, insert, update, delete on public.notifications to authenticated;

-- blocks: owner manages own outgoing blocks; no update policy.
grant select, insert, delete on public.blocks to authenticated;
