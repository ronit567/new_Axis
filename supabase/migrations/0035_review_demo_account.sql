-- Axis — 0035: real App Review demo account replaces the 0018 placeholder.
--
-- 0018 seeded signup_email_exceptions with 'applereview@axis.app' and a note
-- saying to replace it before submission. That address was never a real
-- mailbox, so the whitelist pointed at nothing: App Review could not sign up
-- (the @uwo.ca gate rejects them) and could not sign in (no such account),
-- which is an automatic 2.1 rejection — "we were unable to sign in with the
-- demo account provided".
--
-- This swaps in the address the demo account actually lives on. Being in the
-- whitelist does two things for it:
--   * the @uwo.ca / @alumni.uwo.ca domain gate is bypassed, and
--   * the 14-day re-signup cooldown (0031) is bypassed — which matters
--     because reviewers routinely exercise Settings -> Delete account, and
--     without the exemption that would lock the reviewer out for two weeks
--     mid-review.
--
-- The password is NOT here and must never be: it belongs only in App Store
-- Connect's App Review Notes. This file carries the address alone, which is a
-- role account for the app rather than anyone's personal mailbox.
--
-- ORDER OF OPERATIONS: apply this migration BEFORE creating the auth user.
-- Supabase's before-user-created hook fires for dashboard/admin-created users
-- too, so the row has to exist first or the creation is rejected.
--
-- Creating the user: Dashboard -> Authentication -> Users -> Add user, with
-- "Auto Confirm User" ticked. That skips the emailed OTP entirely. Signing up
-- through the app UI is not an option for this address — CreateAccountScreen
-- gates its submit button on isWesternEmail() client-side, so a non-uwo.ca
-- address can't be submitted there even though the server would allow it.
-- Sign-in has no such gate, so the reviewer signs in normally.

delete from public.signup_email_exceptions
 where email = 'applereview@axis.app';

insert into public.signup_email_exceptions (email, note)
values ('axis.app@outlook.com', 'Apple App Review demo account')
on conflict (email) do update set note = excluded.note;
