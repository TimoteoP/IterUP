-- ============================================================
-- IterUp — Migrazione 007: chat integratori con grounding
-- ------------------------------------------------------------
-- Vedi PRD-addendum-hardening-completamento.md B1. Non tocca la
-- tabella `supplements` esistente. Da eseguire UNA VOLTA nell'SQL
-- Editor di Supabase.
-- ============================================================

create table if not exists public.supplement_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Citazioni web (url_citation) restituite da OpenRouter con web
  -- search grounding: array di {url, title, ...}. Vuoto se la
  -- risposta non ha usato la ricerca web o non ha trovato fonti.
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_supplement_chat_user_date on public.supplement_chat_messages(user_id, created_at);

alter table public.supplement_chat_messages enable row level security;

drop policy if exists "supplement_chat_messages_own" on public.supplement_chat_messages;
create policy "supplement_chat_messages_own" on public.supplement_chat_messages for all using (auth.uid() = user_id);
