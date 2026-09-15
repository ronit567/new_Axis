-- Axis — report-a-review tests (migration 0044).
--
-- Same harness as reports_queue_test.sql: BEGIN ... ROLLBACK, identity via
-- set local role + request.jwt.claims, raises on the first failed assertion,
-- prints ALL REPORT_REVIEWS TESTS PASSED on success. Run after 0011, 0012,
-- 0020 and 0044.
--
-- Two properties: a review can now be reported like any other content, and
-- the widening did not loosen anything — a report naming nothing at all is
-- still rejected, and the queue stays closed to the app roles.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaa1111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'reporter@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbb2222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'author@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dddd4444-4444-4444-8444-444444444444',
   'authenticated', 'authenticated', 'seller@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('aaaa1111-1111-4111-8111-111111111111', 'Reporter'),
  ('bbbb2222-2222-4222-8222-222222222222', 'Review Author'),
  ('dddd4444-4444-4444-8444-444444444444', 'Seller');

-- reviews_insert_reviewer requires a message in either direction, so the
-- fixture has to look like a real conversation before a review can exist.
insert into public.messages (sender_id, receiver_id, body) values
  ('bbbb2222-2222-4222-8222-222222222222',
   'dddd4444-4444-4444-8444-444444444444', 'is this still available?');

insert into public.reviews (id, seller_id, reviewer_id, rating, body) values
  ('eeee5555-5555-4555-8555-555555555555',
   'dddd4444-4444-4444-8444-444444444444',
   'bbbb2222-2222-4222-8222-222222222222', 1, 'an abusive review');

-- A second review by the same author, on a different seller. One review per
-- (seller, reviewer), so a second seller is what makes this legal — and it is
-- what scenario 7 needs to catch the duplicate-guard collision.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'ffff6666-6666-4666-8666-666666666666',
   'authenticated', 'authenticated', 'seller2@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');
insert into public.profiles (id, name) values
  ('ffff6666-6666-4666-8666-666666666666', 'Second Seller');
insert into public.messages (sender_id, receiver_id, body) values
  ('bbbb2222-2222-4222-8222-222222222222',
   'ffff6666-6666-4666-8666-666666666666', 'still for sale?');
insert into public.reviews (id, seller_id, reviewer_id, rating, body) values
  ('cccc7777-7777-4777-8777-777777777777',
   'ffff6666-6666-4666-8666-666666666666',
   'bbbb2222-2222-4222-8222-222222222222', 1, 'a second abusive review');

create function pg_temp.assert(cond boolean, msg text) returns void
  language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'REPORT_REVIEWS TEST FAILED: %', msg;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaa1111-1111-4111-8111-111111111111","role":"authenticated"}', true);

-- ── Scenario 1: a review can be reported, carrying both the review and its
--    author — the same shape a 'listing' report uses for listing + seller.
insert into public.reports
  (reporter_id, target_type, target_review_id, target_user_id, reason)
values
  ('aaaa1111-1111-4111-8111-111111111111', 'review',
   'eeee5555-5555-4555-8555-555555555555',
   'bbbb2222-2222-4222-8222-222222222222', 'harassment');

select pg_temp.assert(
  (select count(*) from public.reports where target_type = 'review') = 1,
  'a review report should be accepted');

-- ── Scenario 2: the target_type check still rejects anything not in the
--    four ReportTarget values.
do $$
begin
  insert into public.reports
    (reporter_id, target_type, target_user_id, reason)
  values
    ('aaaa1111-1111-4111-8111-111111111111', 'banana',
     'bbbb2222-2222-4222-8222-222222222222', 'other');
  raise exception 'REPORT_REVIEWS TEST FAILED: an unknown target_type was accepted';
exception
  when check_violation then
    null; -- expected
end;
$$;

-- ── Scenario 3: widening reports_target_present did not let a report name
--    nothing at all.
do $$
begin
  insert into public.reports (reporter_id, target_type, reason)
  values ('aaaa1111-1111-4111-8111-111111111111', 'review', 'other');
  raise exception 'REPORT_REVIEWS TEST FAILED: a report naming no target was accepted';
exception
  when check_violation then
    null; -- expected: reports_target_present
end;
$$;

reset role;

-- ── Scenario 4: the rebuilt queue joins the review through, so a moderator
--    reads the reported text without a second lookup.
select pg_temp.assert(
  (select target_review_body from public.reports_queue
    where target_type = 'review') = 'an abusive review'
  and (select target_review_rating from public.reports_queue
        where target_type = 'review') = 1
  and (select target_review_seller_id from public.reports_queue
        where target_type = 'review') = 'dddd4444-4444-4444-8444-444444444444',
  'the queue should join in the reported review body, rating and seller');

-- ── Scenario 5: rebuilding the view did not re-expose it. 0012's revokes and
--    0043's single grant must both survive.
select pg_temp.assert(
  not has_table_privilege('anon', 'public.reports_queue', 'SELECT')
  and not has_table_privilege('authenticated', 'public.reports_queue', 'SELECT'),
  'anon and authenticated must still be unable to read reports_queue');
select pg_temp.assert(
  has_table_privilege('service_role', 'public.reports_queue', 'SELECT'),
  'service_role should keep the read 0043 granted it');

-- ── Scenario 6: two different reviews by the same author are two different
--    reports. 0036's duplicate guard compares target_type + target_user_id +
--    target_listing_id; a review report sets the author as target_user_id and
--    leaves target_listing_id null, so without target_review_id in that
--    comparison these two rows look identical to it and the second is rejected
--    as "You have already reported this."
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaa1111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.reports
  (reporter_id, target_type, target_review_id, target_user_id, reason)
values
  ('aaaa1111-1111-4111-8111-111111111111', 'review',
   'cccc7777-7777-4777-8777-777777777777',
   'bbbb2222-2222-4222-8222-222222222222', 'harassment');

reset role;

select pg_temp.assert(
  (select count(*) from public.reports where target_type = 'review') = 2,
  'a second review by the same author must be separately reportable');

-- ── Scenario 7: the guard still catches an actual duplicate — the same
--    review reported twice by the same reporter.
set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"aaaa1111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  insert into public.reports
    (reporter_id, target_type, target_review_id, target_user_id, reason)
  values
    ('aaaa1111-1111-4111-8111-111111111111', 'review',
     'eeee5555-5555-4555-8555-555555555555',
     'bbbb2222-2222-4222-8222-222222222222', 'spam');
  raise exception 'REPORT_REVIEWS TEST FAILED: the same review was reported twice';
exception
  when raise_exception then
    null; -- expected: 0036's duplicate guard, widened by 0044
end;
$$;
reset role;

-- ── Scenario 8: deleting a review takes its reports with it, so the queue
--    never points at content that no longer exists.
delete from public.reviews where id = 'eeee5555-5555-4555-8555-555555555555';
select pg_temp.assert(
  (select count(*) from public.reports
    where target_review_id = 'eeee5555-5555-4555-8555-555555555555') = 0,
  'a deleted review should cascade to its reports');

select 'ALL REPORT_REVIEWS TESTS PASSED' as result;

rollback;
