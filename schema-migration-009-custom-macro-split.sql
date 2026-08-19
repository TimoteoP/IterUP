-- ============================================================
-- IterUp — Migrazione 009: split macro personalizzato per regimi custom
-- ------------------------------------------------------------
-- Prima di questa migrazione, un regime alimentare non tra i preset
-- noti (vedi lib/nutrition-options.ts REGIME_MACRO_SPLITS) usava
-- sempre lo split generico di fallback (45% carbo/30% proteine/25%
-- grassi), senza che l'utente potesse saperlo o correggerlo dalla UI
-- — bug segnalato dall'utente con un regime "Digiuno Integrato" che
-- mostrava macro non pertinenti. Aggiunge un campo opzionale dove
-- l'utente può specificare il proprio split (%) quando il regime
-- scelto non ne ha uno predefinito. Da eseguire UNA VOLTA nell'SQL
-- Editor di Supabase.
-- ============================================================

alter table public.profiles
  add column if not exists custom_macro_split jsonb;
