-- Axis — 0032: server-side content filter for user-generated text.
--
-- App Store Guideline 1.2 requires UGC apps to ship "a method for filtering
-- objectionable material from being posted" alongside report/block/contact.
-- Axis had the latter three (0011, 0001/0002 blocks, in-app support address)
-- but nothing filtered text at the point of posting — listings, messages,
-- profiles, and reviews all inserted raw.
--
-- This adds a banned_terms table plus BEFORE triggers on every user-writable
-- text surface. Living in Postgres (not the client) means a modified client or
-- direct PostgREST call can't skip it, mirroring how 0018 moved the @uwo.ca
-- gate server-side. The list is deliberately conservative — unambiguous slurs
-- and profanity where a whole-word match can't false-positive on ordinary
-- marketplace copy ("Scunthorpe problem"); moderators extend it from Studio /
-- service_role, no code change needed.

create table if not exists public.banned_terms (
  -- Lowercase words/phrases only, plain [a-z0-9] + single spaces. The CHECK
  -- doubles as regex-injection protection: contains_banned_term() interpolates
  -- terms into a regex, so metacharacters must be impossible to store.
  term        text primary key
              check (term = lower(term) and term ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  note        text,
  created_at  timestamptz not null default now()
);

comment on table public.banned_terms is
  'Whole-word blocklist enforced by triggers on listings/messages/profiles/reviews (Guideline 1.2 content filtering). Managed via Studio/service_role only.';

-- Same lockdown as signup_email_exceptions (0018): RLS on with no client
-- policies, and no PostgREST surface. The triggers read it via SECURITY
-- DEFINER, so client roles never need to see it (and letting them read it
-- would hand abusers the exact evasion list).
alter table public.banned_terms enable row level security;
revoke all on public.banned_terms from public, anon, authenticated;

insert into public.banned_terms (term) values
  ('fuck'), ('motherfucker'), ('shit'), ('bitch'), ('cunt'),
  ('whore'), ('slut'), ('pussy'), ('cock'), ('porn'),
  ('nigger'), ('nigga'), ('faggot'), ('fag'), ('retard'),
  ('kike'), ('spic'), ('chink'), ('tranny'), ('wetback'),
  ('raghead'), ('beaner')
on conflict (term) do nothing;

-- Whole-word, case-insensitive match. \m/\M are Postgres word boundaries, so
-- 'shit' matches "total shit" but not "sushi table" — and a listing for
-- "Cocker Spaniel books" or "Dickens" survives intact. SECURITY DEFINER so the
-- check can read banned_terms past its RLS; STABLE because it only reads.
create or replace function public.contains_banned_term(t text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.banned_terms b
    where coalesce(t, '') ~* ('\m' || b.term || '\M')
  );
$$;

-- Not an RPC: only the trigger bodies below call this. Exposing it would let
-- clients probe the blocklist term-by-term.
revoke all on function public.contains_banned_term(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- One trigger per surface, each with copy the app can show verbatim — the
-- screens' catch blocks already surface error.message in an alert, so the
-- raise text is the user-facing explanation.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_listing_content()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if public.contains_banned_term(new.title) or public.contains_banned_term(new.description) then
    raise exception 'This listing contains language that isn''t allowed on Axis. Please reword it and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listings_content_filter on public.listings;
create trigger trg_listings_content_filter
  before insert or update of title, description on public.listings
  for each row execute function public.enforce_listing_content();

create or replace function public.enforce_message_content()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if public.contains_banned_term(new.body) then
    raise exception 'This message contains language that isn''t allowed on Axis. Please reword it and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_content_filter on public.messages;
create trigger trg_messages_content_filter
  before insert on public.messages
  for each row execute function public.enforce_message_content();

create or replace function public.enforce_profile_content()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if public.contains_banned_term(new.name) or public.contains_banned_term(new.bio) then
    raise exception 'Your profile contains language that isn''t allowed on Axis. Please reword it and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_content_filter on public.profiles;
create trigger trg_profiles_content_filter
  before insert or update of name, bio on public.profiles
  for each row execute function public.enforce_profile_content();

create or replace function public.enforce_review_content()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if public.contains_banned_term(new.body) then
    raise exception 'This review contains language that isn''t allowed on Axis. Please reword it and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_content_filter on public.reviews;
create trigger trg_reviews_content_filter
  before insert or update of body on public.reviews
  for each row execute function public.enforce_review_content();

-- Trigger execution doesn't consult the invoking user's EXECUTE privilege, so
-- these revokes only remove the pointless PostgREST RPC surface (same
-- reasoning as the notify_* trigger functions).
revoke all on function public.enforce_listing_content() from public, anon, authenticated;
revoke all on function public.enforce_message_content() from public, anon, authenticated;
revoke all on function public.enforce_profile_content() from public, anon, authenticated;
revoke all on function public.enforce_review_content() from public, anon, authenticated;
