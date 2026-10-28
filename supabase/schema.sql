-- ============================================================================
-- SubTranslate - Supabase Free Tier schema
-- Run this in Supabase Studio -> SQL Editor -> New query -> Run.
--
-- Includes:
--   * profiles          : public user profile (auto-created on sign-up)
--   * user_preferences  : cloud backup of subtitle/app preferences
--   * transcript_sessions: optional transcription history
--   * Row Level Security on every table
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile for email and anonymous users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'guest'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Cloud preferences
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Preferences are owner readable" on public.user_preferences;
create policy "Preferences are owner readable"
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Preferences are owner writable" on public.user_preferences;
create policy "Preferences are owner writable"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Preferences are owner updatable" on public.user_preferences;
create policy "Preferences are owner updatable"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Optional transcript history
-- ---------------------------------------------------------------------------
create table if not exists public.transcript_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  source_lang text,
  target_lang text,
  engine text,
  duration_seconds integer,
  segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transcript_sessions_user_created_idx
  on public.transcript_sessions (user_id, created_at desc);

alter table public.transcript_sessions enable row level security;

drop policy if exists "Transcripts are owner readable" on public.transcript_sessions;
create policy "Transcripts are owner readable"
  on public.transcript_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Transcripts are owner insertable" on public.transcript_sessions;
create policy "Transcripts are owner insertable"
  on public.transcript_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Transcripts are owner deletable" on public.transcript_sessions;
create policy "Transcripts are owner deletable"
  on public.transcript_sessions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Free Tier housekeeping
-- ---------------------------------------------------------------------------
-- Optional: delete anonymous accounts older than 30 days to stay inside the
-- free auth quota. Schedule with pg_cron if you outgrow the free tier.
-- select cron.schedule('prune-anon-users', '0 3 * * *', $$
--   delete from auth.users
--   where is_anonymous = true and created_at < now() - interval '30 days';
-- $$);

comment on table public.profiles is 'SubTranslate user profiles (auto-created by trigger).';
comment on table public.user_preferences is 'Cloud backup for SubTranslate preferences.';
comment on table public.transcript_sessions is 'Optional transcription history, opt-in from Settings.';
