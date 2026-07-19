-- Axis — 0023: per-photo thumbnail variants for listing grids.
--
-- Grid cards were loading the same full-resolution storage object as the
-- detail gallery. The app now uploads two on-device-resized JPEG variants per
-- photo (a ~1600px detail image and a ~480px thumb) and persists the thumb
-- URLs here, index-parallel to image_urls. thumb_urls is deliberately a
-- separate column rather than interleaved into image_urls — every existing
-- consumer (detail gallery, edit flow, proposed_image_urls) indexes that
-- array positionally.
--
-- Rows without thumbs (pre-0023 listings, review-applied photo edits) are
-- handled in the ONE mapping layer (mappers.ts): thumbUrls[i] falls back to
-- image_urls[i], so a missing thumb degrades to full-res, never breaks.
alter table public.listings
  add column if not exists thumb_urls text[] not null default '{}';

-- The engaged-listing edit guard (0021) reviews photo changes because the
-- images are a scam bait-and-switch vector. The grid renders thumb_urls, so
-- an unguarded thumb_urls would let a seller swap what buyers actually see
-- in the feed without tripping review. Guard it exactly like image_urls.
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
    or new.thumb_urls is distinct from old.thumb_urls
  ) and public.is_listing_engaged(old.id) then
    raise exception 'listing_edit_requires_review' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- apply_listing_edit (0021) promotes proposed_image_urls into image_urls, but
-- edit requests carry no thumbs. Leaving thumb_urls untouched there would
-- pair the OLD thumbnails positionally with the NEW photos — the grid would
-- show images of a different photo set. Clear thumb_urls whenever the photo
-- set is replaced by review, so the mapper's full-res fallback takes over.
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
      thumb_urls  = case when r.proposed_image_urls is not null then '{}' else thumb_urls end
  where id = r.listing_id;

  update public.listing_edit_requests
  set status = 'approved', reviewed_at = now()
  where id = r.id;
end;
$$;
