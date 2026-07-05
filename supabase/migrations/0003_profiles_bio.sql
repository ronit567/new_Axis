-- Axis — AX-301: onboarding profile capture.
-- SetupProfile's "About you" field needs somewhere to land; nothing else in
-- 0001/0002 covers it.
alter table public.profiles add column if not exists bio text;
