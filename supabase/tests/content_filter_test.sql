-- Axis — content filter tests (migration 0032).
--
-- 0001 + 0002 + 0003 + 0005 + 0032 must already be applied. Runs inside
-- BEGIN ... ROLLBACK (no data left behind), raises on the first failure, and
-- prints 'ALL CONTENT FILTER TESTS PASSED' on success. Same identity-switching
-- idiom as rls_policies_test.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'poster@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
   'authenticated', 'authenticated', 'receiver@test.uwo.ca', 'test-fixture-not-a-real-hash',
   now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, name) values
  ('44444444-4444-4444-4444-444444444444', 'Poster'),
  ('55555555-5555-5555-5555-555555555555', 'Receiver');

set local role authenticated;
select set_config('request.jwt.claims',
       '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

-- ── A clean listing posts fine. ──
insert into public.listings (seller_id, title, description)
  values ('44444444-4444-4444-4444-444444444444', 'Calculus textbook', 'Barely used, no highlights');

-- ── A banned term in the title is rejected. ──
do $$
begin
  insert into public.listings (seller_id, title)
    values ('44444444-4444-4444-4444-444444444444', 'this shit textbook');
  raise exception 'FILTER TEST FAILED: banned term in listing title was accepted';
exception
  when raise_exception then
    if sqlerrm like 'FILTER TEST FAILED%' then raise; end if; -- expected: trigger raise
end;
$$;

-- ── A banned term in the description is rejected. ──
do $$
begin
  insert into public.listings (seller_id, title, description)
    values ('44444444-4444-4444-4444-444444444444', 'Desk lamp', 'only a bitch would lowball me');
  raise exception 'FILTER TEST FAILED: banned term in listing description was accepted';
exception
  when raise_exception then
    if sqlerrm like 'FILTER TEST FAILED%' then raise; end if;
end;
$$;

-- ── Whole-word only: no Scunthorpe false positives on compounds. ──
insert into public.listings (seller_id, title, description)
  values ('44444444-4444-4444-4444-444444444444', 'Cocker Spaniel guide', 'Includes a Dickens novel and a shiitake cookbook');

-- ── Case doesn't matter. ──
do $$
begin
  insert into public.messages (sender_id, receiver_id, body)
    values ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 'FUCK off');
  raise exception 'FILTER TEST FAILED: uppercase banned term in message was accepted';
exception
  when raise_exception then
    if sqlerrm like 'FILTER TEST FAILED%' then raise; end if;
end;
$$;

-- ── A clean message sends fine. ──
insert into public.messages (sender_id, receiver_id, body)
  values ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 'Is the textbook still available?');

-- ── Profile bio is filtered on update. ──
do $$
begin
  update public.profiles set bio = 'resident slut' where id = '44444444-4444-4444-4444-444444444444';
  raise exception 'FILTER TEST FAILED: banned term in profile bio was accepted';
exception
  when raise_exception then
    if sqlerrm like 'FILTER TEST FAILED%' then raise; end if;
end;
$$;

reset role;

-- ── The blocklist itself is invisible to client roles. ──
set local role authenticated;
do $$
begin
  perform count(*) from public.banned_terms;
  raise exception 'FILTER TEST FAILED: authenticated could read banned_terms';
exception
  when insufficient_privilege then null; -- expected: no grant
end;
$$;
reset role;

do $$ begin raise notice 'ALL CONTENT FILTER TESTS PASSED'; end $$;

rollback;
