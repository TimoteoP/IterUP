-- ============================================================
-- IterUp — Migrazione 008: Coach Comportamentale
-- ------------------------------------------------------------
-- Vedi PRD-addendum-coach-comportamentale.md sezione 6. Additiva:
-- non tocca nessuna tabella esistente. Da eseguire UNA VOLTA
-- nell'SQL Editor di Supabase.
-- ============================================================

create table if not exists public.coach_nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  trigger_type text not null,
  trigger_data jsonb not null default '{}',
  message text not null,
  tone_used text,
  shown_at timestamptz default now(),
  reaction text check (reaction in ('like', 'dislike', 'dismissed')),
  created_at timestamptz default now()
);

create index if not exists idx_coach_nudges_user_type on public.coach_nudges(user_id, trigger_type, created_at);

create table if not exists public.coach_preferences (
  user_id uuid references auth.users(id) on delete cascade not null,
  trigger_type text not null,
  enabled boolean default true,
  preferred_tone text,
  satisfaction_score numeric,
  last_shown_at timestamptz,
  primary key (user_id, trigger_type)
);

create table if not exists public.daily_focus (
  user_id uuid references auth.users(id) on delete cascade not null,
  focus_date date not null default current_date,
  priority_1 text,
  priority_2 text,
  priority_3 text,
  created_at timestamptz default now(),
  primary key (user_id, focus_date)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_date date not null default current_date,
  content text not null,
  created_at timestamptz default now(),
  unique (user_id, entry_date)
);

alter table public.coach_nudges enable row level security;
alter table public.coach_preferences enable row level security;
alter table public.daily_focus enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists "coach_nudges_own" on public.coach_nudges;
create policy "coach_nudges_own" on public.coach_nudges for all using (auth.uid() = user_id);

drop policy if exists "coach_preferences_own" on public.coach_preferences;
create policy "coach_preferences_own" on public.coach_preferences for all using (auth.uid() = user_id);

drop policy if exists "daily_focus_own" on public.daily_focus;
create policy "daily_focus_own" on public.daily_focus for all using (auth.uid() = user_id);

drop policy if exists "journal_entries_own" on public.journal_entries;
create policy "journal_entries_own" on public.journal_entries for all using (auth.uid() = user_id);
