-- ============================================================
-- IterUp — Migrazione 004: Bussola di Ricomposizione Corporea
-- ------------------------------------------------------------
-- Estende body_metrics (invece di creare una tabella separata, per
-- decisione esplicita) con i campi richiesti dal check-in bussola.
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase.
-- ============================================================

alter table public.body_metrics
  add column if not exists hip_cm numeric,
  add column if not exists kcal_period numeric,
  add column if not exists neck_feel smallint,
  add column if not exists wrist_feel smallint,
  add column if not exists sex_at_checkin text;

alter table public.body_metrics drop constraint if exists body_metrics_neck_feel_check;
alter table public.body_metrics
  add constraint body_metrics_neck_feel_check check (neck_feel in (-1, 0, 1));

alter table public.body_metrics drop constraint if exists body_metrics_wrist_feel_check;
alter table public.body_metrics
  add constraint body_metrics_wrist_feel_check check (wrist_feel in (-1, 0, 1));

alter table public.body_metrics drop constraint if exists body_metrics_sex_at_checkin_check;
alter table public.body_metrics
  add constraint body_metrics_sex_at_checkin_check check (sex_at_checkin in ('m', 'f'));
