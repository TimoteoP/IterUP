-- ============================================================
-- IterUp — Migrazione 006: ricerca alimenti tollerante ai typo
-- ------------------------------------------------------------
-- Vedi PRD-addendum-hardening-completamento.md A5. Abilita pg_trgm e
-- un indice trigram su foods.name, usato come fallback quando la
-- ricerca full-text esistente (idx_foods_name) non trova nulla — non
-- la sostituisce, la integra. Da eseguire UNA VOLTA nell'SQL Editor
-- di Supabase.
-- ============================================================

create extension if not exists pg_trgm;

create index if not exists idx_foods_name_trgm on public.foods using gin (name gin_trgm_ops);

-- RPC richiamabile via PostgREST (supabaseServer.rpc(...)): PostgREST
-- non permette di ordinare per una funzione arbitraria (similarity())
-- direttamente da query builder, serve una funzione dedicata.
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
