-- ============================================================
-- IterUp - Schema database (CANONICO — riflette lo stato target)
-- ------------------------------------------------------------
-- Questo è l'UNICO schema.sql valido per il progetto. Non va
-- rigenerato da nessun agente: le tabelle esistono già nel
-- progetto Supabase collegato, con la tabella foods già popolata
-- (179 alimenti). Questo file serve come riferimento/backup e per
-- eventuali nuovi ambienti (staging, ecc.) creati da zero.
--
-- ATTENZIONE: per il DB già esistente, applicare le modifiche
-- rispetto alla versione precedente tramite
-- schema-migration-002-addendum.sql (non rieseguire questo file
-- per intero su un DB già popolato: i `create table if not exists`
-- non alterano le tabelle esistenti).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILO UTENTE (dati fisici base per calcolo TDEE + preferenze)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  sex text check (sex in ('m', 'f')),
  birth_date date,
  height_cm numeric,
  activity_level text check (activity_level in ('sedentario', 'leggero', 'moderato', 'attivo', 'molto_attivo')),
  -- Regime alimentare: lista aperta (mediterraneo, keto, vegano,
  -- vegetariano, ... e nuovi valori creati liberamente dall'utente
  -- dalla UI) — nessun CHECK, i preset noti vivono solo lato codice
  -- in /lib/nutrition-options.ts, non nello schema.
  dietary_regime text default 'mediterraneo',
  -- Split macro (%) scelto dall'utente per il regime attuale, SOLO
  -- quando questo non è tra i preset noti (che hanno uno split fisso
  -- in lib/nutrition-options.ts). Forma: {"carbPct":n,"proteinPct":n,
  -- "fatPct":n}, somma 100. Null = nessuno split custom impostato
  -- (fallback generico 45/30/25). Vedi schema-migration-009.
  custom_macro_split jsonb,
  -- Vincolo HARD per il generatore AI: mai proporre pasti con questi ingredienti.
  allergies text[] not null default '{}',
  -- Vincolo SOFT: preferenze di gusto, orientano ma non bloccano.
  preferences text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. OBIETTIVI NUTRIZIONALI (target macro correnti)
-- ------------------------------------------------------------
create table if not exists public.user_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  -- Tipo di dieta scelto direttamente dall'utente (non derivato dal
  -- delta peso attuale/obiettivo — vedi decisione supervisore che
  -- sovrascrive PRD-addendum-onboarding-form.md sezione 2.1). Lista
  -- aperta, tenuta in sync con /lib/nutrition-options.ts: aggiungere
  -- qui nuovi valori non richiede altre modifiche allo schema.
  mode text check (mode in ('dimagrimento', 'mantenimento', 'costruzione_muscolare', 'recupero')) not null,
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

-- Ricerca tollerante ai typo (fallback quando il full-text sopra non
-- trova nulla, es. "pomodooro") — vedi
-- PRD-addendum-hardening-completamento.md A5.
create extension if not exists pg_trgm;
create index if not exists idx_foods_name_trgm on public.foods using gin (name gin_trgm_ops);

create or replace function public.search_foods_trgm(search_term text, match_limit int default 20)
returns setof public.foods
language sql
stable
as $$
  select *
  from public.foods
  where similarity(name, search_term) > 0.2
  order by similarity(name, search_term) desc
  limit match_limit;
$$;

-- ------------------------------------------------------------
-- 4. DIARIO ALIMENTARE
-- ------------------------------------------------------------
-- food_id è nullable perché le voci 'digiuno' e 'integrazione' non
-- referenziano un alimento della tabella foods (vedi addendum sezione 3).
-- kcal/protein_g/carbs_g/fat_g/fiber_g sono uno snapshot calcolato una
-- volta sola al momento del log (food.<campo>_100g * quantity_g / 100),
-- non un valore vivo: così lo storico resta corretto anche se in futuro
-- i valori nutrizionali di un alimento in `foods` cambiassero.
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  food_id uuid references public.foods(id),
  quantity_g numeric,
  meal_type text check (meal_type in ('colazione', 'pranzo', 'cena', 'spuntino', 'digiuno', 'integrazione')) not null,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric,
  logged_at date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, logged_at);

-- ------------------------------------------------------------
-- 5. MISURE CORPOREE (peso, collo, petto, vita, coscia + check-in
--    Bussola di Ricomposizione: fianchi, kcal periodo, percezione
--    soggettiva collo/polso — vedi
--    PRD-addendum-bussola-ricomposizione.md sezione 3. Un'unica
--    tabella condivisa tra /misure e la Bussola (stesso storico,
--    stesso vincolo un-record-al-giorno) invece di due tabelle
--    parallele, per decisione esplicita del supervisore.
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
  -- Campi Bussola di Ricomposizione (nullable: non ogni misurazione è
  -- un check-in bussola completo).
  hip_cm numeric, -- richiesto lato form solo se profilo.sex = 'f'
  wrist_cm numeric, -- indicatore di contesto, non entra nel calcolo BF%/IR
  kcal_period numeric, -- kcal totali dal check-in precedente a questo
  neck_feel smallint check (neck_feel in (-1, 0, 1)), -- -1 più pieno, 0 uguale, 1 più sottile
  wrist_feel smallint check (wrist_feel in (-1, 0, 1)), -- -1 più stretto, 0 uguale, 1 più largo
  -- Sesso dichiarato nel profilo AL MOMENTO di questo check-in
  -- (snapshot, non un riferimento vivo a profiles.sex): se l'utente
  -- corregge il sesso nel profilo in futuro, lo storico bussola resta
  -- calcolato con il sesso corretto per ogni check-in — vedi addendum
  -- sezione 7 "Cambio di sesso nel profilo tra un check-in e l'altro".
  sex_at_checkin text check (sex_at_checkin in ('m', 'f')),
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

-- ------------------------------------------------------------
-- 10. INTEGRATORI POSSEDUTI (fonte per generatore AI e chat Q&A)
-- ------------------------------------------------------------
-- Vedi PRD-addendum-onboarding-form.md sezione 5.1. dosage è un campo
-- libero ma strutturato (sostanza + quantità per unità, es. "Berberina
-- HCL 500mg"), non normalizzato in colonne separate: per l'MVP a un
-- solo utente non serve altro.
create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  dosage text,
  unit text,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_supplements_user on public.supplements(user_id);

-- ------------------------------------------------------------
-- 11. VALUTAZIONI PROPOSTE PASTO AI (A3)
-- ------------------------------------------------------------
-- `proposal` è uno snapshot jsonb dell'intera proposta valutata
-- (nome/ingredienti/macro): la proposta potrebbe non essere mai stata
-- aggiunta al diario, quindi non può essere un riferimento a
-- daily_logs. Serve a tracciare la qualità percepita nel tempo.
create table if not exists public.meal_suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  meal_type text not null,
  model_used text,
  proposal jsonb not null,
  liked boolean not null,
  created_at timestamptz default now()
);

create index if not exists idx_meal_feedback_user on public.meal_suggestion_feedback(user_id);

-- ------------------------------------------------------------
-- 12. ALIMENTI AGGIUNTI MANUALMENTE
-- ------------------------------------------------------------
-- Nessuna tabella separata: le voci create dall'utente da UI (vedi
-- app/api/foods/route.ts) vanno semplicemente in `foods` con
-- source = 'manual' invece di 'usda', per distinguerle nello storico.

-- ------------------------------------------------------------
-- 13. CHAT INTEGRATORI (con web search grounding)
-- ------------------------------------------------------------
-- Vedi PRD-addendum-hardening-completamento.md B1. citations è
-- l'array di url_citation restituito da OpenRouter quando il modello
-- usa la ricerca web (tools: [{"type":"openrouter:web_search"}]).
create table if not exists public.supplement_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_supplement_chat_user_date on public.supplement_chat_messages(user_id, created_at);

-- ------------------------------------------------------------
-- 14. COACH COMPORTAMENTALE
-- ------------------------------------------------------------
-- Vedi PRD-addendum-coach-comportamentale.md. coach_nudges = ogni
-- messaggio generato (trigger + reazione); coach_preferences =
-- switch on/off e tono preferito per trigger_type; daily_focus = le
-- 3 priorità del rituale mattutino; journal_entries = "Note del
-- giorno" lette dal rituale serale (nome tabella distinto dal
-- diario alimentare per evitare confusione).
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
alter table public.supplements enable row level security;
alter table public.meal_suggestion_feedback enable row level security;
alter table public.supplement_chat_messages enable row level security;
alter table public.coach_nudges enable row level security;
alter table public.coach_preferences enable row level security;
alter table public.daily_focus enable row level security;
alter table public.journal_entries enable row level security;

create policy "foods_read_all" on public.foods for select using (true);
create policy "foods_insert_all" on public.foods for insert with check (true);
create policy "profiles_own" on public.profiles for all using (auth.uid() = id);
create policy "user_targets_own" on public.user_targets for all using (auth.uid() = user_id);
create policy "daily_logs_own" on public.daily_logs for all using (auth.uid() = user_id);
create policy "body_metrics_own" on public.body_metrics for all using (auth.uid() = user_id);
create policy "activity_logs_own" on public.activity_logs for all using (auth.uid() = user_id);
create policy "habits_own" on public.habits for all using (auth.uid() = user_id);
create policy "habit_logs_own" on public.habit_logs for all using (auth.uid() = user_id);
create policy "goals_own" on public.goals for all using (auth.uid() = user_id);
create policy "supplements_own" on public.supplements for all using (auth.uid() = user_id);
create policy "meal_suggestion_feedback_own" on public.meal_suggestion_feedback for all using (auth.uid() = user_id);
create policy "supplement_chat_messages_own" on public.supplement_chat_messages for all using (auth.uid() = user_id);
create policy "coach_nudges_own" on public.coach_nudges for all using (auth.uid() = user_id);
create policy "coach_preferences_own" on public.coach_preferences for all using (auth.uid() = user_id);
create policy "daily_focus_own" on public.daily_focus for all using (auth.uid() = user_id);
create policy "journal_entries_own" on public.journal_entries for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Setup una tantum: crea l'unico utente fisso dell'app
-- (vedi PRD sezione 3bis). Esegui, poi copia l'id restituito
-- in /lib/config.ts come CURRENT_USER_ID.
-- ------------------------------------------------------------
-- insert into auth.users (id, email) values (gen_random_uuid(), 'me@iterup.local')
-- returning id;
