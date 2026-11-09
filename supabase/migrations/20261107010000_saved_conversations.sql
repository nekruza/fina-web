-- Run in the Supabase SQL editor of Fina's project, after
-- 20261107000000_english_uk.sql. Additive and idempotent.
--
-- Learners can choose to keep the transcript of each practice call so they can
-- read it again later. Saving is opt-in: nothing is stored until the learner
-- switches it on. Voice audio is never stored, only the text.

alter table public.profiles
  add column if not exists save_transcripts boolean not null default false;

create table if not exists public.saved_conversations (
  -- The id the start route gave the call (sessionId), so saving again with the
  -- same id updates the row instead of making a copy.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  roleplay_id text not null check (char_length(roleplay_id) <= 100),
  roleplay_title text not null check (char_length(roleplay_title) <= 200),
  tutor_id text not null check (char_length(tutor_id) <= 50),
  language text not null check (char_length(language) <= 30),
  level text not null check (char_length(level) <= 30),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  message_count integer not null default 0 check (message_count >= 0),
  -- [{ "role": "user" | "assistant", "content": "..." }, ...]
  messages jsonb not null check (jsonb_typeof(messages) = 'array'),
  -- LanguageAnalysis from /api/ai/feedback; null until feedback arrives.
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_conversations_user_created_idx
  on public.saved_conversations (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Each learner can read, add, change and delete only their own transcripts.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.saved_conversations enable row level security;

revoke all on public.saved_conversations from anon;
grant select, insert, update, delete on public.saved_conversations to authenticated;

drop policy if exists "saved_conversations_select_own" on public.saved_conversations;
create policy "saved_conversations_select_own" on public.saved_conversations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saved_conversations_insert_own" on public.saved_conversations;
create policy "saved_conversations_insert_own" on public.saved_conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_conversations_update_own" on public.saved_conversations;
create policy "saved_conversations_update_own" on public.saved_conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_conversations_delete_own" on public.saved_conversations;
create policy "saved_conversations_delete_own" on public.saved_conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);
