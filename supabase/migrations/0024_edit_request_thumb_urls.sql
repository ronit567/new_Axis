-- Axis — 0024: carry thumbnail variants through the edit-review flow.
--
-- 0023 cleared listings.thumb_urls whenever a review promoted
-- proposed_image_urls, because edit requests carried no thumbs. But the
-- client had already uploaded the _thumb objects for the proposed photo set
-- and then dropped them — orphaning storage objects and permanently
-- regressing the reviewed listing's grid cards to full-res detail images.
-- Requests now carry proposed_thumb_urls (index-parallel to
-- proposed_image_urls, same convention as listings.image_urls/thumb_urls)
-- and apply_listing_edit promotes both together.
--
-- NULL follows the 0021 "NULL = unchanged" convention and is only
-- meaningful alongside proposed_image_urls; the table-level insert grant
-- (0021) covers the new column. Requests filed before this migration have
-- no thumbs for their proposed photo set, so applying them still clears
-- thumb_urls and the mapper's full-res fallback takes over (0023).
alter table public.listing_edit_requests
  add column if not exists proposed_thumb_urls text[];

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

  perform set_config('axis.bypass_edit_guard', 'on', true);

  update public.listings
  set title       = coalesce(r.proposed_title, title),
      category    = coalesce(r.proposed_category, category),
      condition   = coalesce(r.proposed_condition, condition),
      image_urls  = coalesce(r.proposed_image_urls, image_urls),
      -- A replaced photo set takes its own thumbs; coalesce degrades
      -- pre-0024 requests to the cleared-thumbs behaviour rather than
      -- mispairing the old thumbs with the new photos.
      thumb_urls  = case
        when r.proposed_image_urls is not null then coalesce(r.proposed_thumb_urls, '{}')
        else thumb_urls
      end
  where id = r.listing_id;

  update public.listing_edit_requests
  set status = 'approved', reviewed_at = now()
  where id = r.id;
end;
$$;
