-- ============================================================
-- IterUp — Migrazione 005: circonferenza polso (Bussola)
-- ------------------------------------------------------------
-- Petto/coscia esistevano già (tabella condivisa con /misure); manca
-- solo il polso. Da eseguire UNA VOLTA nell'SQL Editor di Supabase.
-- ============================================================

alter table public.body_metrics
  add column if not exists wrist_cm numeric;
