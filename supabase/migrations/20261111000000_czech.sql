-- Run in the Supabase SQL editor of Fina's project, after
-- 20261107010000_saved_conversations.sql. Idempotent.
--
-- Adds Czech ('czech') as a target language. profiles.target_language is
-- limited by a CHECK constraint, so the new id has to be added to it. Every
-- value the constraint already allowed is kept, including 'turkish', which the
-- mobile app writes.

alter table public.profiles drop constraint if exists profiles_target_language_check;

alter table public.profiles
  add constraint profiles_target_language_check
  check (target_language in (
    'english', 'english_uk', 'spanish', 'french', 'german', 'chinese',
    'japanese', 'turkish', 'portuguese', 'russian', 'arabic', 'czech'
  ));
