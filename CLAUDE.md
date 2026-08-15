# CLAUDE.md — Istruzioni per Claude Code su IterUp

Questo file viene letto automaticamente a ogni sessione. Contiene le regole operative
per lavorare su questo progetto. Per il dettaglio funzionale di ogni modulo, vedi
`PRD.md` nella root del repo.

## Cos'è questo progetto

IterUp: PWA Next.js + Supabase per tracciare dieta, macro, peso, attività e abitudini.
Uso personale, single-user, MVP.

## Regole non negoziabili

0. **`/schema.sql` è un file fisico fornito, non va rigenerato.** Le tabelle esistono già
   nel progetto Supabase collegato (inclusa `foods` già popolata con 179 alimenti). Se
   `/schema.sql` non è presente nel repo all'inizio della Fase 0, FERMATI e chiedi il file
   invece di ricostruire lo schema dalla descrizione a parole nel PRD — la descrizione a
   parole non è precisa quanto le colonne reali (es. `user_targets.mode`, i campi esatti
   di `body_metrics`), e uno schema reinventato non corrisponde al database vero.
1. **Niente login/auth.** Un solo utente fisso (vedi `/lib/config.ts` → `CURRENT_USER_ID`).
   Tutte le query passano dalle API route server-side con la service role key. Non creare
   MAI form di login, signup, reset password, o gestione sessione — è una scelta esplicita
   documentata in PRD.md sezione 3bis, non una dimenticanza.
2. **Non modificare i contratti condivisi** senza autorizzazione esplicita: `/schema.sql`,
   `/lib/types.ts`, `/lib/supabase/server.ts`, `/lib/config.ts`, `/lib/design-tokens.ts`.
   Se un modulo ha bisogno di un campo DB in più, fermati e segnalalo invece di modificare
   lo schema da solo.
3. **La service role key non finisce MAI nel client.** Va solo in `.env.local` come
   `SUPABASE_SERVICE_ROLE_KEY` (senza prefisso `NEXT_PUBLIC_`), usata solo dentro
   `/app/api/**/route.ts`. Se stai scrivendo un componente client (`"use client"`) e ti
   serve la service role key, ti stai sbagliando: passa dai un'API route.
4. **TypeScript strict, Tailwind per lo stile**, componenti funzionali React. Nessuna
   nuova libreria di UI/CSS senza motivo — usa `/lib/design-tokens.ts`.
5. **Ogni modifica deve passare `npm run build`** prima di essere considerata completa.

## Come procedere — workflow multi-agente

Questo progetto è pensato per essere sviluppato con agenti paralleli in worktree separati,
non con un'unica sessione lineare. Segui questa sequenza:

### Fase 0 — Fondamenta (tu, sessione principale, sequenziale)
Scrivi i contratti condivisi elencati sopra (schema già pronto in `/schema.sql`, generane
i types, crea `server.ts`, `config.ts` con lo `user_id` fisso, `design-tokens.ts`).
Non procedere alla Fase 1 finché questi file non esistono e non compilano.

### Fase 1 — Moduli indipendenti (parallelo, un worktree per agente)
Lancia in parallelo, ognuno nel proprio worktree/branch:
- Onboarding (A1)
- Diario Alimentare (A2)
- Peso e Misure (A4)
- Abitudini e Obiettivi (A5)
- Attività Fisica (A6)
- Shell PWA & Design System (A8)

Ogni agente riceve un prompt auto-contenuto (vedi template in PRD.md sezione 6) che include:
i file di contratto da leggere, l'obiettivo, i file di sua esclusiva competenza, i criteri
di accettazione. Non lanciare un agente senza questo prompt completo — parte senza memoria
di questa conversazione.

### Fase 2 — Dipendenti (dopo che A2 ha una query `foods` funzionante)
- Generatore Pasti AI (A3) — dipende dalla tabella foods interrogabile da A2

### Fase 3 — Dipendenti (dopo che A2, A4, A6 hanno scritto dati reali)
- Statistiche (A7) — legge dati scritti da altri moduli, sola lettura, nessun conflitto file

### Fase 4 — Integrazione (tu, sessione principale, sequenziale)
Per ogni worktree completato, in ordine: revisiona il diff, esegui `npm run build`, integra
nel branch principale, **un branch alla volta** — non tutti insieme in blocco. Se un agente
ha segnalato una dipendenza mancante o un'assunzione, risolvila prima di procedere al
successivo.

## Cosa NON fare

- Non creare schermate di autenticazione (vedi regola 1)
- Non modificare i contratti condivisi da un agente specializzato
- Non lanciare A3 o A7 insieme alla Fase 1 — dipendono da moduli non ancora pronti
- Non esporre la service role key lato client
- Non inventare nuovi pattern di stile fuori da `/lib/design-tokens.ts`

## Riferimenti

- Dettaglio funzionale completo di ogni modulo, criteri di accettazione, rischi: `PRD.md`
- Schema database: `/schema.sql`
