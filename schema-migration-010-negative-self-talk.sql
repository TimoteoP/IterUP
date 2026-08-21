-- ============================================================
-- IterUp — Migrazione 010: Negative Self-Talk & Cognitive Reframing
-- ------------------------------------------------------------
-- Vedi PRD-addendum-negative-self-talk.md. Additiva: non tocca
-- nessuna tabella esistente. Da eseguire UNA VOLTA nell'SQL Editor
-- di Supabase.
--
-- Differenze deliberate rispetto allo schema abbozzato
-- nell'addendum (sezione 3), decise con l'utente prima di questa
-- migrazione:
-- - Ogni tabella ha una colonna `user_id` propria (coerente con le
--   convenzioni già in uso in tutto lo schema: nessuna query passa
--   da join per il filtro utente, vedi CLAUDE.md regola 1) — non era
--   esplicita nell'abbozzo generico dell'addendum.
-- - `flag_type` NON include 'crisis_language': l'utente ha chiesto
--   esplicitamente di non includere alcun rilevamento/messaggio di
--   crisi né numeri di emergenza in questo modulo, per uso personale
--   di uno strumento di miglioramento, non di supporto in crisi.
--   pattern_flags resta solo per frequency_high/intensity_high/
--   theme_concentration, usati per indicazioni e consigli.
-- - `theme` è un CHECK enum fisso ai 5 valori (scelta esplicita
--   dell'utente, coerente con la tassonomia distorsioni fissa).
-- ============================================================

create table if not exists public.self_talk_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  raw_text text not null,
  mood_before smallint check (mood_before between 1 and 10),
  theme text check (theme in ('lavoro', 'corpo', 'relazioni', 'economico', 'altro')),
  created_at timestamptz not null default now(),
  guided_session_started boolean not null default false,
  guided_session_completed boolean not null default false
);

create index if not exists idx_self_talk_entries_user_date on public.self_talk_entries(user_id, created_at);

create table if not exists public.distortion_tags (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.self_talk_entries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  distortion_type text not null check (distortion_type in (
    'ALL_OR_NOTHING', 'OVERGENERALIZATION', 'MENTAL_FILTER', 'DISCOUNTING_POSITIVE',
    'JUMPING_TO_CONCLUSIONS', 'MAGNIFICATION', 'EMOTIONAL_REASONING',
    'SHOULD_STATEMENTS', 'LABELING', 'PERSONALIZATION'
  )),
  source text not null check (source in ('user', 'llm')),
  created_at timestamptz not null default now()
);

create index if not exists idx_distortion_tags_entry on public.distortion_tags(entry_id);

create table if not exists public.reframe_sessions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.self_talk_entries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  evidence_for text,
  evidence_against text,
  consider_opposite text not null,
  reframe_text text,
  mood_after smallint check (mood_after between 1 and 10),
  llm_transcript jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.pattern_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  flag_type text not null check (flag_type in ('frequency_high', 'intensity_high', 'theme_concentration')),
  window_start date not null,
  window_end date not null,
  summary_text text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_pattern_flags_user on public.pattern_flags(user_id, created_at);

alter table public.self_talk_entries enable row level security;
alter table public.distortion_tags enable row level security;
alter table public.reframe_sessions enable row level security;
alter table public.pattern_flags enable row level security;

drop policy if exists "self_talk_entries_own" on public.self_talk_entries;
create policy "self_talk_entries_own" on public.self_talk_entries for all using (auth.uid() = user_id);

drop policy if exists "distortion_tags_own" on public.distortion_tags;
create policy "distortion_tags_own" on public.distortion_tags for all using (auth.uid() = user_id);

drop policy if exists "reframe_sessions_own" on public.reframe_sessions;
create policy "reframe_sessions_own" on public.reframe_sessions for all using (auth.uid() = user_id);

drop policy if exists "pattern_flags_own" on public.pattern_flags;
create policy "pattern_flags_own" on public.pattern_flags for all using (auth.uid() = user_id);
