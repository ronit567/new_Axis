-- Axis — 0048: evaluate the block check once per statement, not once per row.
--
-- listings_select_public and profiles_select_public hide anyone the caller has
-- blocked, or been blocked by, with
--
--     not public.is_blocked((select auth.uid()), seller_id)
--
-- 0042 wrapped auth.uid() in a scalar subquery so Postgres evaluates it once
-- (an InitPlan). The same trick cannot be applied to is_blocked(): its second
-- argument is a column of the row being tested, so the call has to run for
-- every row the scan touches. And it is not a cheap call — SECURITY DEFINER with
-- a pinned search_path means Postgres cannot inline it, so each row pays a
-- security-context switch, a GUC push/pop, an executor start-up and two index
-- probes into blocks.
--
-- A shallow, ordered feed page hides this: twenty rows, twenty calls. Search
-- does not. RLS quals are security-barrier quals, and ILIKE is not leakproof,
-- so Postgres must run the policy BEFORE the search filter — is_blocked() runs
-- for every active listing, however few match. The same goes for a deep feed
-- page (skipped OFFSET rows are still filtered) and for the inbox and
-- notification hydration queries.
--
-- Measured on a throwaway local Postgres with this policy, 3,000 listings and
-- 400 blocks: see the PR for the numbers. Production holds one listing, so
-- nothing can be measured there; this is reasoned from the plan shape.
--
-- The fix is to turn the question around. "Is this seller blocked?" needs the
-- row; "who is blocked, for me?" does not. That set is computed once per
-- statement and the per-row work becomes a comparison against an array.
--
-- BEHAVIOUR IS UNCHANGED. For the caller `me`, is_blocked(me, x) is true exactly
-- when a blocks row exists for (me -> x) or (x -> me), which is exactly
-- membership of x in the set below. supabase/tests/rls_policies_test.sql
-- exercises the block-hiding rules and passes unmodified.
--
-- public.is_blocked() stays: the INSERT policies on follows and messages check
-- one row per statement, where a per-row call costs nothing, and it remains the
-- readable statement of the rule.
--
-- Idempotent; no data change; no table rewrite. Dropping and recreating a
-- policy takes a brief ACCESS EXCLUSIVE lock on the table.

-- ── A schema PostgREST does not expose ──────────────────────────────────────
-- config.toml exposes only `public` and `graphql_public`, so nothing here is
-- reachable as /rest/v1/rpc/*. The function below only means something inside a
-- policy, and is kept off the API surface on purpose.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.blocked_counterparts()
  returns uuid[]
  language sql
  stable
  security definer
  -- Empty, not `public`: every reference below is schema-qualified, so nothing
  -- in the caller's search_path can be substituted for it.
  set search_path = ''
as $$
  select coalesce(array_agg(x.other_id), '{}'::uuid[])
  from (
    select b.blocked_id as other_id
    from public.blocks b
    where b.blocker_id = (select auth.uid())
    union
    select b.blocker_id
    from public.blocks b
    where b.blocked_id = (select auth.uid())
  ) x;
$$;

comment on function private.blocked_counterparts() is
  'Everyone the caller has blocked or been blocked by, as an array. For RLS '
  'policies only: call it as (select private.blocked_counterparts()) so it is '
  'an InitPlan, evaluated once per statement. Never expose the private schema.';

revoke all on function private.blocked_counterparts() from public;
revoke all on function private.blocked_counterparts() from anon;
grant execute on function private.blocked_counterparts() to authenticated;

-- ── The two SELECT policies ─────────────────────────────────────────────────
-- The ::uuid[] cast is load-bearing. Without it `= any ((select ...))` parses as
-- a row-wise sublink and fails with "operator does not exist: uuid = uuid[]".
--
-- An empty array is the common case (most people block nobody): `x = any('{}')`
-- is false, so `not (...)` is true and nothing is hidden.

drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings for select
  to authenticated
  using (
    (select auth.uid()) = seller_id
    or (
      status = 'active'
      and not (seller_id = any ((select private.blocked_counterparts())::uuid[]))
    )
  );

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or not (id = any ((select private.blocked_counterparts())::uuid[]))
  );
