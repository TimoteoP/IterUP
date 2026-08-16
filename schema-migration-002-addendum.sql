-- ============================================================
-- IterUp — Migrazione 002: addendum onboarding (regime/allergie/
-- preferenze, mode esteso, meal_type esteso, tabella integratori)
-- ------------------------------------------------------------
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase sul progetto
-- già esistente (isrxayzjztarixyzulis). Porta il DB live allo stato
-- descritto nella versione aggiornata di /schema.sql.
-- ============================================================

-- 1. profiles: nuovi campi per regime alimentare, allergie, preferenze
alter table public.profiles
  add column if not exists dietary_regime text check (dietary_regime in ('mediterraneo', 'keto', 'paleo', 'high_carb')) default 'mediterraneo',
  add column if not exists allergies text[] not null default '{}',
  add column if not exists preferences text[] not null default '{}';

-- 2. user_targets: mode passa da (loss, maintain, gain) a una lista
--    aperta di tipi di dieta scelti direttamente dall'utente.
--    Rimappa i valori esistenti prima di stringere il constraint.
update public.user_targets set mode = 'dimagrimento' where mode = 'loss';
update public.user_targets set mode = 'mantenimento' where mode = 'maintain';
update public.user_targets set mode = 'costruzione_muscolare' where mode = 'gain';

alter table public.user_targets drop constraint if exists user_targets_mode_check;
alter table public.user_targets
  add constraint user_targets_mode_check
  check (mode in ('dimagrimento', 'mantenimento', 'costruzione_muscolare', 'recupero'));

-- 3. daily_logs: food_id/quantity_g diventano opzionali (digiuno non ha
--    un alimento associato), meal_type include 'digiuno' e 'integrazione',
--    kcal/protein_g/carbs_g/fat_g hanno un default 0 esplicito.
alter table public.daily_logs alter column food_id drop not null;
alter table public.daily_logs alter column quantity_g drop not null;
alter table public.daily_logs alter column kcal set default 0;
alter table public.daily_logs alter column protein_g set default 0;
alter table public.daily_logs alter column carbs_g set default 0;
alter table public.daily_logs alter column fat_g set default 0;

alter table public.daily_logs drop constraint if exists daily_logs_meal_type_check;
alter table public.daily_logs
  add constraint daily_logs_meal_type_check
  check (meal_type in ('colazione', 'pranzo', 'cena', 'spuntino', 'digiuno', 'integrazione'));

-- 4. Nuova tabella: integratori posseduti dall'utente
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

alter table public.supplements enable row level security;

drop policy if exists "supplements_own" on public.supplements;
create policy "supplements_own" on public.supplements for all using (auth.uid() = user_id);
