-- Axis — 0053: signed-out browsing of listings, with no seller identity.
--
-- App Review (Guideline 5.1.1(v)) requires that listings can be browsed before
-- registering. 0034 and 0040 took every table read away from anon so that the
-- bundled anon key cannot be used to enumerate students, and that stays true:
-- this migration grants no table privilege and changes no policy.
--
-- Instead anon gets two read-only functions that return listing columns only.
-- They are SECURITY DEFINER because anon has no SELECT on listings to invoke
-- with, so the column list and the WHERE clause below ARE the access rule:
--
--   returned: id, title, description, price, is_free, is_trade, condition,
--             category, image_urls, thumb_urls, status, created_at
--   withheld: seller_id (and with it every profile column), pickup, views
--
-- Only active listings are returned. Block filtering does not apply: a guest
-- has no identity to block, and no seller is revealed to them.
--
-- `supabase db advisors` will list both functions under
-- anon_security_definer_function_executable. That finding is the point of this
-- migration, not drift; 0038's "zero findings" note predates it.

-- ── Feed and search ─────────────────────────────────────────────────────────
-- Same filters, order and page size as ListingRepository.search: every filter
-- is optional and they combine with AND. p_query matches title OR description
-- literally, so LIKE metacharacters in it are escaped here.
create or replace function public.guest_listings(
  p_query      text    default null,
  p_categories text[]  default null,
  p_condition  text    default null,
  p_max_price  numeric default null,
  p_limit      integer default 20,
  p_offset     integer default 0
)
  returns table (
    id          uuid,
    title       text,
    description text,
    price       numeric,
    is_free     boolean,
    is_trade    boolean,
    condition   text,
    category    text,
    image_urls  text[],
    thumb_urls  text[],
    status      text,
    created_at  timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    l.id, l.title, l.description, l.price, l.is_free, l.is_trade,
    l.condition, l.category, l.image_urls, l.thumb_urls, l.status, l.created_at
  from public.listings l
  cross join lateral (
    select '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      as pattern
  ) q
  where l.status = 'active'
    and (
      p_query is null
      or btrim(p_query) = ''
      or l.title ilike q.pattern
      or l.description ilike q.pattern
    )
    and (
      p_categories is null
      or cardinality(p_categories) = 0
      or l.category = any (p_categories)
    )
    and (p_condition is null or l.condition = p_condition)
    and (p_max_price is null or l.price <= p_max_price)
  order by l.created_at desc, l.id
  -- Clamped server-side: the caller holds only the public key, so the page
  -- size is not theirs to choose.
  limit least(greatest(coalesce(p_limit, 20), 1), 20)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ── One listing ─────────────────────────────────────────────────────────────
-- No row for a sold or deleted listing: the signed-in detail screen opens sold
-- listings for the people involved in them, and a guest is never one of those.
create or replace function public.guest_listing(p_id uuid)
  returns table (
    id          uuid,
    title       text,
    description text,
    price       numeric,
    is_free     boolean,
    is_trade    boolean,
    condition   text,
    category    text,
    image_urls  text[],
    thumb_urls  text[],
    status      text,
    created_at  timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    l.id, l.title, l.description, l.price, l.is_free, l.is_trade,
    l.condition, l.category, l.image_urls, l.thumb_urls, l.status, l.created_at
  from public.listings l
  where l.id = p_id
    and l.status = 'active';
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Revoke first: Postgres grants EXECUTE to PUBLIC on creation (see 0038), and
-- the grant below should be the whole statement of who may call these.
-- authenticated is included so a request that still carries a session token
-- while the app is signing out gets rows instead of a permission error.
revoke all on function public.guest_listings(text, text[], text, numeric, integer, integer)
  from public, anon, authenticated;
revoke all on function public.guest_listing(uuid)
  from public, anon, authenticated;

grant execute on function public.guest_listings(text, text[], text, numeric, integer, integer)
  to anon, authenticated;
grant execute on function public.guest_listing(uuid)
  to anon, authenticated;
