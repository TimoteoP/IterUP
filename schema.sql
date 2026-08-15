-- ============================================================
-- IterUp - Schema database (CANONICO — già applicato su Supabase)
-- ------------------------------------------------------------
-- Questo è l'UNICO schema.sql valido per il progetto. Non va
-- rigenerato da nessun agente: le tabelle esistono già nel
-- progetto Supabase collegato, con la tabella foods già popolata
-- (179 alimenti). Questo file serve solo come riferimento/backup
-- e per eventuali nuovi ambienti (staging, ecc.).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILO UTENTE (dati fisici base per calcolo TDEE)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  sex text check (sex in ('m', 'f')),
  birth_date date,
  height_cm numeric,
  activity_level text check (activity_level in ('sedentario', 'leggero', 'moderato', 'attivo', 'molto_attivo')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. OBIETTIVI NUTRIZIONALI (target macro correnti)
-- ------------------------------------------------------------
create table if not exists public.user_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mode text check (mode in ('loss', 'maintain', 'gain')) not null,
  daily_kcal numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. DATABASE ALIMENTI (già popolato con 179 voci curate da USDA)
-- ------------------------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  kcal_100g numeric not null,
  protein_100g numeric not null,
  carbs_100g numeric not null,
  fat_100g numeric not null,
  fiber_100g numeric,
  source text,
  source_id text,
  created_at timestamptz default now()
);

create index if not exists idx_foods_category on public.foods(category);
create index if not exists idx_foods_name on public.foods using gin (to_tsvector('italian', name));

-- ------------------------------------------------------------
-- 4. DIARIO ALIMENTARE
-- ------------------------------------------------------------
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  food_id uuid references public.foods(id) not null,
  quantity_g numeric not null,
  meal_type text check (meal_type in ('colazione', 'pranzo', 'cena', 'spuntino')) not null,
  kcal numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, logged_at);

-- ------------------------------------------------------------
-- 5. MISURE CORPOREE (peso, collo, petto, vita, coscia)
-- ------------------------------------------------------------
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  recorded_at date not null default current_date,
  weight_kg numeric,
  neck_cm numeric,
  chest_cm numeric,
  waist_cm numeric,
  thigh_cm numeric,
  created_at timestamptz default now(),
  unique (user_id, recorded_at)
);

create index if not exists idx_body_metrics_user_date on public.body_metrics(user_id, recorded_at);

-- ------------------------------------------------------------
-- 6. ATTIVITA' FISICA (passi + allenamenti)
-- ------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  recorded_at date not null default current_date,
  steps integer,
  source text,
  workout_type text,
  workout_minutes integer,
  calories_burned numeric,
  created_at timestamptz default now(),
  unique (user_id, recorded_at, workout_type)
);

create index if not exists idx_activity_logs_user_date on public.activity_logs(user_id, recorded_at);

-- ------------------------------------------------------------
-- 7. ABITUDINI (definizione)
-- ------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text check (type in ('boolean', 'quantity')) not null,
  unit text,
  target_value numeric,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 8. ABITUDINI (log giornaliero)
-- ------------------------------------------------------------
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references public.habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  recorded_at date not null default current_date,
  completed boolean,
  value numeric,
  created_at timestamptz default now(),
  unique (habit_id, recorded_at)
);

create index if not exists idx_habit_logs_user_date on public.habit_logs(user_id, recorded_at);

-- ------------------------------------------------------------
-- 9. OBIETTIVI GENERALI (peso, attività, abitudini, custom)
-- ------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_type text check (goal_type in ('weight', 'habit_streak', 'activity', 'custom')) not null,
  title text not null,
  target_value numeric,
  target_date date,
  status text check (status in ('in_corso', 'raggiunto', 'abbandonato')) default 'in_corso',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_goals_user on public.goals(user_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Nessun agente costruisce login (vedi CLAUDE.md): tutte le query
-- passano da API route server-side con la service role key, che
-- bypassa RLS. Le policy restano come difesa in profondità.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_targets enable row level security;
alter table public.daily_logs enable row level security;
alter table public.body_metrics enable row level security;
alter table public.activity_logs enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.goals enable row level security;
alter table public.foods enable row level security;

create policy "foods_read_all" on public.foods for select using (true);
create policy "profiles_own" on public.profiles for all using (auth.uid() = id);
create policy "user_targets_own" on public.user_targets for all using (auth.uid() = user_id);
create policy "daily_logs_own" on public.daily_logs for all using (auth.uid() = user_id);
create policy "body_metrics_own" on public.body_metrics for all using (auth.uid() = user_id);
create policy "activity_logs_own" on public.activity_logs for all using (auth.uid() = user_id);
create policy "habits_own" on public.habits for all using (auth.uid() = user_id);
create policy "habit_logs_own" on public.habit_logs for all using (auth.uid() = user_id);
create policy "goals_own" on public.goals for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Setup una tantum: crea l'unico utente fisso dell'app
-- (vedi PRD sezione 3bis). Esegui, poi copia l'id restituito
-- in /lib/config.ts come CURRENT_USER_ID.
-- ------------------------------------------------------------
-- insert into auth.users (id, email) values (gen_random_uuid(), 'me@iterup.local')
-- returning id;
