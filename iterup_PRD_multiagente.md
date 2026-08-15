# IterUp — PRD per sviluppo multi-agente (Claude Code)

## 1. Visione del progetto

IterUp è una PWA (Next.js + Supabase) per tracciare dieta, macronutrienti, peso/misure,
attività fisica e abitudini quotidiane, con generazione automatica di idee pasto via AI.
Uso personale, cross-device (iPhone + desktop), MVP in 1-2 settimane.

**Non-goals per l'MVP**: multi-utente/social, notifiche push native, integrazione diretta
HealthKit (si usa Shortcuts → webhook), database alimenti oltre le ~180 voci curate.

---

## 2. Stack tecnico (CONGELATO — nessun agente lo cambia)

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase: Postgres + Auth + Row Level Security
- Claude API (Sonnet) per il generatore di pasti
- Deploy: Vercel
- PWA: manifest.json + service worker minimo per installazione home screen

---

## 3. Contratti condivisi (da scrivere PRIMA di lanciare qualunque agente)

Questi artefatti sono la superficie di contatto tra agenti. Vanno creati da un agente
"Foundation" (o dal supervisore stesso) in un unico passaggio iniziale, poi congelati:

1. **`/schema.sql`** — già scritto e applicato su Supabase (9 tabelle: profiles,
   user_targets, foods, daily_logs, body_metrics, activity_logs, habits, habit_logs, goals)
2. **`/lib/types.ts`** — tipi TypeScript generati dallo schema (`supabase gen types typescript`)
3. **`/lib/supabase/server.ts`** — client Supabase server-side con **service role key**
   (bypassa RLS). Tutte le API route usano questo client, mai il client anon nel browser.
4. **`/lib/config.ts`** — esporta `CURRENT_USER_ID`, un UUID fisso creato una volta sola
   (vedi sezione 3bis). Ogni query filtra esplicitamente su questo ID invece che su `auth.uid()`.
5. **`/lib/design-tokens.ts`** — palette colori, spacing, font (per coerenza visiva tra moduli
   scritti da agenti diversi)
6. **API route naming convention**: `/app/api/<modulo>/<azione>/route.ts`

Nessun agente specializzato modifica questi 6 artefatti. Se un agente scopre che gli serve
un campo mancante nello schema, lo segnala al supervisore invece di modificarlo da solo.

### 3bis. Autenticazione — DEFERRED (decisione esplicita)

Per l'MVP **non c'è login**. Un solo utente (l'admin, cioè tu), nessuna gestione ruoli.
Setup una tantum:

```sql
-- Esegui una volta sola in Supabase SQL Editor per creare lo "user" fisso
insert into auth.users (id, email) values (gen_random_uuid(), 'me@iterup.local')
returning id;  -- copia questo UUID in /lib/config.ts come CURRENT_USER_ID
```

Tutte le API route usano il client server-side con service role key + `CURRENT_USER_ID`
hardcoded, bypassando le policy RLS. Nessun agente costruisce schermate di login, form di
password, o gestione sessione. Quando (e se) servirà un vero sistema multi-utente, si
sostituisce questo meccanismo con Supabase Auth reale — è un cambio isolato ai file di
sezione 3, non tocca i moduli funzionali.

---

## 4. Architettura agenti

### Supervisore (main Claude Code session)

Responsabilità:
- Scrive i contratti condivisi (sezione 3) prima di tutto il resto
- Crea un git worktree per ogni agente specializzato
- Lancia gli agenti con prompt auto-contenuti (ogni agente parte senza memoria della
  conversazione principale, quindi il prompt deve includere: obiettivo, file di contesto
  da leggere, contratti da rispettare, criteri di accettazione)
- Al termine di ogni agente: revisiona il diff, esegue build/lint, integra nel branch
  principale, risolve conflitti
- Non scrive codice applicativo direttamente — coordina e valida

### Agenti specializzati (paralleli, ognuno in un proprio worktree/branch)

| Agente | Ambito | File di sua competenza | Dipende da |
|---|---|---|---|
| **A1 — Onboarding** | Form dati fisici, calcolo TDEE (Mifflin-St Jeor), scrittura `user_targets` (NIENTE login/signup — vedi sezione 3bis) | `/app/onboarding/*`, `/lib/tdee.ts` | Contratti (sez. 3) |
| **A2 — Diario Alimentare** | Ricerca alimenti, form log pasto, vista macro residui giornalieri | `/app/diario/*`, `/app/api/foods/search/route.ts`, `/app/api/logs/*` | Contratti |
| **A3 — Generatore Pasti AI** | Chiamata Claude API, prompt engineering con macro residui + tabella foods, UI 5 proposte | `/app/api/suggest-meal/route.ts`, `/app/diario/components/MealSuggestions.tsx` | A2 (legge stessa tabella foods, ma non tocca i suoi file) |
| **A4 — Peso e Misure** | Form inserimento, storico, validazione range | `/app/misure/*`, `/app/api/body-metrics/*` | Contratti |
| **A5 — Abitudini e Obiettivi** | CRUD abitudini, log giornaliero, tabella goals generalizzata | `/app/abitudini/*`, `/app/obiettivi/*`, `/app/api/habits/*`, `/app/api/goals/*` | Contratti |
| **A6 — Attività Fisica** | Endpoint webhook per Shortcuts iOS, form manuale allenamenti | `/app/api/activity/ingest/route.ts`, `/app/attivita/*` | Contratti |
| **A7 — Statistiche** | Aggregazioni settimana/mese, grafici (peso nel tempo, media macro, aderenza) | `/app/statistiche/*` | Legge dati scritti da A2/A4/A6 (sola lettura, nessun conflitto file) |
| **A8 — Shell PWA & Design System** | Layout, navigazione, manifest, `design-tokens.ts`, tema | `/app/layout.tsx`, `/components/nav/*`, `/lib/design-tokens.ts` | Va per primo o in parallelo puro (nessuna dipendenza) |

**Nota sull'isolamento**: la tabella sopra è costruita apposta perché ogni agente scriva
prevalentemente file che nessun altro tocca. Le uniche zone di sovrapposizione potenziale
(componenti condivisi, layout) sono di competenza esclusiva di A8.

---

## 5. Sequenza di esecuzione consigliata

```
Fase 0 (supervisore, sequenziale)
  └─ Scrive contratti condivisi (sezione 3)

Fase 1 (parallelo — 8 worktree separati)
  ├─ A1 Auth & Onboarding
  ├─ A2 Diario Alimentare
  ├─ A4 Peso e Misure
  ├─ A5 Abitudini e Obiettivi
  ├─ A6 Attività Fisica
  └─ A8 Shell PWA & Design System

Fase 2 (parallelo, dopo che A2 ha un fdcId/tabella foods query funzionante)
  └─ A3 Generatore Pasti AI

Fase 3 (dopo che A2, A4, A6 hanno scritto dati reali)
  └─ A7 Statistiche

Fase 4 (supervisore, sequenziale)
  └─ Integrazione branch, test end-to-end, deploy su Vercel
```

---

## 6. Template prompt per lanciare un agente (esempio: A2)

```
Sei l'agente "Diario Alimentare" del progetto IterUp.

CONTESTO (leggi questi file prima di iniziare):
- /schema.sql (schema DB — NON modificarlo)
- /lib/types.ts (tipi condivisi — NON modificarli)
- /lib/supabase/client.ts (usa questo client, non crearne uno nuovo)
- /lib/design-tokens.ts (usa questi token per lo stile, non inventare colori)

OBIETTIVO:
Costruisci il modulo diario alimentare:
1. /app/api/foods/search/route.ts — endpoint di ricerca full-text sulla tabella `foods`
2. /app/diario/page.tsx — UI: barra di ricerca, selezione alimento, input quantità (g),
   selezione pasto (colazione/pranzo/cena/spuntino), salvataggio in `daily_logs`
3. Vista "macro residui oggi": somma i daily_logs del giorno corrente vs target in
   `user_targets`, mostra barre di progresso per kcal/proteine/carbo/grassi

VINCOLI:
- Lavora SOLO nei file elencati sopra + eventuali nuovi file dentro /app/diario/
- Non modificare schema.sql, types.ts, o file di altri moduli
- Usa Tailwind, componenti funzionali React, TypeScript strict

CRITERI DI ACCETTAZIONE:
- La ricerca alimenti funziona e filtra su nome (italiano)
- Il salvataggio di un log crea una riga corretta in daily_logs con RLS rispettata
  (auth.uid() = user_id)
- La vista macro residui si aggiorna dopo ogni log senza refresh manuale
- `npm run build` passa senza errori

Al termine, riporta: file creati/modificati, eventuali assunzioni fatte, eventuali
dipendenze scoperte che il supervisore deve conoscere.
```

(Gli altri 7 agenti seguono lo stesso schema, con obiettivo e vincoli specifici della loro riga in tabella.)

---

## 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Due agenti modificano lo stesso file per errore | Worktree separati per agente + revisione diff del supervisore prima del merge |
| Schema drift (un agente "avrebbe bisogno" di un campo in più) | L'agente lo segnala, non lo aggiunge da solo; il supervisore decide e aggiorna schema.sql + types.ts centralmente |
| Stile visivo incoerente tra moduli | design-tokens.ts congelato in Fase 0, tutti gli agenti lo importano invece di inventare colori/spacing |
| Costo token elevato (8 agenti paralleli) | Usa Haiku per gli agenti più semplici (A4 Peso, A6 webhook) e Sonnet per quelli con logica più complessa (A2, A3, A7) |
| A3 (generatore pasti) dipende dalla query alimenti di A2 | Sequenziato in Fase 2, non lanciato insieme a A2 |
| Merge conflict residuo nonostante l'isolamento | Il supervisore integra un branch alla volta, esegue build dopo ognuno, non tutti insieme in blocco |

---

## 8. Definition of Done (MVP completo)

- [ ] Onboarding calcola TDEE e macro target, salva su user_targets (nessun login richiesto)
- [ ] Diario alimentare: ricerca, log pasto, macro residui in tempo reale
- [ ] Generatore pasti: 5 proposte coerenti con macro residui
- [ ] Peso/misure: inserimento e storico visibile
- [ ] Abitudini: definizione, log giornaliero (boolean e quantità)
- [ ] Obiettivi: creazione, stato (in corso/raggiunto)
- [ ] Attività: endpoint webhook riceve passi da Shortcuts, form manuale allenamenti
- [ ] Statistiche: grafico peso nel tempo, media macro settimanale/mensile
- [ ] PWA installabile da Safari su iPhone, layout coerente mobile/desktop
- [ ] `npm run build` passa, deploy su Vercel funzionante
