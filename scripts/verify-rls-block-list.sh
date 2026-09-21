#!/bin/sh
# verify-rls-block-list.sh — prove that migration 0048 changes how the block
# check is evaluated and not what anyone can see.
#
# 0048 rewrites two RLS policies. A policy rewrite that is "obviously
# equivalent" is exactly the kind of change that quietly leaks a blocked user's
# listings, so this does not argue equivalence, it checks it: on a throwaway
# local Postgres it installs the pre-0048 policy and function, seeds users,
# listings and blocks, records precisely which listings and profiles each user
# can see, applies the real migration file, records again, and requires the two
# to be identical for every user. It also prints timings for the queries the
# change is meant to help.
#
# Nothing here touches Supabase. It needs a local Postgres (initdb, pg_ctl,
# psql on PATH — `brew install postgresql@16`) and takes a few seconds.
#
# Usage:
#   sh scripts/verify-rls-block-list.sh
#
# The "before" definitions below are pinned copies of 0002 (is_blocked) and 0042
# (the two policies). They are the state 0048 replaces; they are not meant to
# track later migrations.

set -eu

MIGRATION="supabase/migrations/0048_rls_block_list_initplan.sql"
USERS=300
PORT=${VERIFY_PG_PORT:-54399}

for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null 2>&1 || { echo "FATAL: $tool not found (brew install postgresql@16)"; exit 1; }
done
[ -f "$MIGRATION" ] || { echo "FATAL: run from the repo root ($MIGRATION not found)"; exit 1; }

# TCP on loopback rather than a unix socket: socket paths are capped at ~100
# bytes and a temp directory easily exceeds that.
WORK=$(mktemp -d)
cleanup() { pg_ctl -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" \
  -l "$WORK/pg.log" -w start >/dev/null
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres

echo "==> RLS block-list equivalence check ($(psql -Atc 'show server_version'))"

psql -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
-- Stand-in for Supabase's auth.uid(): reads the same request setting.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create table public.profiles (id uuid primary key, name text not null);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null, description text,
  status text not null default 'active',
  created_at timestamptz not null default now());
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  primary key (blocker_id, blocked_id));
create index blocks_blocked_id_idx on public.blocks (blocked_id);
create index listings_active_created_at_idx on public.listings (created_at desc) where status = 'active';
grant select on public.profiles, public.listings to authenticated;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.blocks enable row level security;

-- Pinned from 0002_rls_policies.sql.
create function public.is_blocked(a uuid, b uuid)
  returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.blocks
    where (auth.uid() = a or auth.uid() = b)
      and ((blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
  );
$$;

-- Pinned from 0042_rls_initplan.sql.
create policy "listings_select_public" on public.listings for select to authenticated
  using ((((select auth.uid()) = seller_id) OR ((status = 'active'::text) AND (NOT public.is_blocked((select auth.uid()), seller_id)))));
create policy "profiles_select_public" on public.profiles for select to authenticated
  using (((id = (select auth.uid())) OR (NOT public.is_blocked((select auth.uid()), id))));

-- 300 users, 3,000 listings (about 70% active), blocks in both directions: a
-- minority who block a lot, a mutual pair, one very heavy blocker, and a
-- majority who block nobody (the empty-array case).
select setseed(0.42);
insert into public.profiles select md5('u' || g)::uuid, 'user ' || g from generate_series(1, 300) g;
insert into public.listings (seller_id, title, description, status, created_at)
select md5('u' || (1 + floor(random() * 300))::int)::uuid,
       'Calculus textbook ' || g, repeat('Lightly used, pickup near campus. ', 10),
       case when random() < 0.7 then 'active' else 'sold' end,
       now() - (g || ' minutes')::interval
from generate_series(1, 3000) g;
insert into public.blocks
select distinct a, b from (
  select md5('u' || (1 + floor(random() * 60))::int)::uuid a,
         md5('u' || (1 + floor(random() * 300))::int)::uuid b
  from generate_series(1, 450)) p
where a <> b on conflict do nothing;
insert into public.blocks values (md5('u7')::uuid, md5('u8')::uuid), (md5('u8')::uuid, md5('u7')::uuid)
  on conflict do nothing;
insert into public.blocks select md5('u299')::uuid, md5('u' || g)::uuid from generate_series(100, 180) g
  on conflict do nothing;
analyze;
SQL

# One row per user: how many listings and profiles they can see, and a hash of
# exactly which ones.
snapshot() {
  g=1
  while [ "$g" -le "$USERS" ]; do
    cat <<SQL
begin;
select set_config('request.jwt.claim.sub', md5('u$g')::uuid::text, true);
set local role authenticated;
select $g,
  (select count(*) from public.listings),
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.listings),
  (select count(*) from public.profiles),
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles);
commit;
SQL
    g=$((g + 1))
  done | psql -At -F'|' -q -v ON_ERROR_STOP=1 | grep -E '^[0-9]+\|'
}

# Best of five, as the role the app uses.
timing() {
  for _ in 1 2 3 4 5; do
    psql -q 2>&1 <<'SQL'
begin;
select set_config('request.jwt.claim.sub', md5('u1')::uuid::text, true);
set local role authenticated;
\echo '@@ search, no matches'
explain (analyze, costs off, timing off) select * from public.listings
  where status = 'active' and seller_id <> (select auth.uid())
    and (title ilike '%zzzz%' or description ilike '%zzzz%')
  order by created_at desc limit 20;
\echo '@@ feed, offset 500'
explain (analyze, costs off, timing off) select * from public.listings
  where status = 'active' and seller_id <> (select auth.uid())
  order by created_at desc limit 20 offset 500;
\echo '@@ 100 profiles by id (inbox hydration)'
explain (analyze, costs off, timing off) select id, name from public.profiles
  where id in (select md5('u' || g)::uuid from generate_series(1, 100) g);
commit;
SQL
  done | awk '
    /^@@/ { k = substr($0, 4) }
    /Execution Time/ { if (!(k in best) || $3 < best[k]) best[k] = $3 }
    /is_blocked/ { how[k] = "is_blocked() per row" }
    END { for (k in best) printf "    %-40s %7.2f ms   %s\n", k, best[k], (k in how ? how[k] : "once per statement") }' | sort
}

snapshot >"$WORK/before.txt"
HIDDEN=$(awk -F'|' -v n="$USERS" '$4 < n' "$WORK/before.txt" | wc -l | tr -d ' ')
SETS=$(cut -d'|' -f3 "$WORK/before.txt" | sort -u | wc -l | tr -d ' ')
echo "    seeded: $USERS users, $(psql -Atc 'select count(*) from public.listings') listings, $(psql -Atc 'select count(*) from public.blocks') blocks"
echo "    $HIDDEN of $USERS users have someone hidden from them; $SETS distinct listing views"
echo ""
echo "  before 0048:"
timing

psql -q -v ON_ERROR_STOP=1 -f "$MIGRATION" >/dev/null
# Twice, because a migration that is replayed must not fail.
psql -q -v ON_ERROR_STOP=1 -f "$MIGRATION" >/dev/null 2>&1

echo "  after 0048:"
timing
snapshot >"$WORK/after.txt"

echo ""
if diff "$WORK/before.txt" "$WORK/after.txt" >"$WORK/diff.txt"; then
  echo "PASS: every one of $USERS users sees exactly the same listings and profiles."
else
  echo "FAIL: visibility changed for $(grep -c '^<' "$WORK/diff.txt") user(s):"
  head -n 10 "$WORK/diff.txt" | sed 's/^/    /'
  exit 1
fi

# The function must not be reachable by anyone but the policies' own role.
LEAK=$(psql -Atc "select has_function_privilege('anon', 'private.blocked_counterparts()', 'execute')
                     or has_schema_privilege('anon', 'private', 'usage')")
if [ "$LEAK" = "f" ]; then
  echo "PASS: anon has no access to the private schema or the function."
else
  echo "FAIL: anon can reach private.blocked_counterparts()."
  exit 1
fi
