-- ============================================================
-- IterUp — Migrazione 003: regime alimentare aperto, valutazioni
-- proposte AI, insert manuale su foods
-- ------------------------------------------------------------
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase.
-- ============================================================

-- 1. profiles.dietary_regime: rimuove il CHECK, diventa lista aperta
--    (mediterraneo/keto/vegano/vegetariano/... + valori custom creati
--    dall'utente dalla UI). I preset noti restano solo lato codice
--    in lib/nutrition-options.ts.
alter table public.profiles drop constraint if exists profiles_dietary_regime_check;

-- 2. Nuova tabella: valutazioni (like/dislike) delle proposte pasto AI
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

alter table public.meal_suggestion_feedback enable row level security;

drop policy if exists "meal_suggestion_feedback_own" on public.meal_suggestion_feedback;
create policy "meal_suggestion_feedback_own" on public.meal_suggestion_feedback for all using (auth.uid() = user_id);

-- 3. foods: consente insert (per il tasto "aggiungi alimento" in UI).
--    Bypassato comunque dalla service role key usata dalle API route,
--    ma tenuto come difesa in profondità coerente con le altre tabelle.
drop policy if exists "foods_insert_all" on public.foods;
create policy "foods_insert_all" on public.foods for insert with check (true);
