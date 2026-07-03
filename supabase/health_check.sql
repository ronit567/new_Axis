-- Milestone 5 smoke test — throwaway table. Drop after the roundtrip works.
-- No RLS: it exists only to prove the client can insert/select end to end.
create table if not exists public.health_check (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

-- Cleanup (run after Milestone 5 passes):
-- drop table public.health_check;
