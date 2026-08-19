# IterUp — Documentazione

IterUp è una PWA (Progressive Web App) personale per tracciare dieta, peso, composizione
corporea, attività fisica e abitudini quotidiane, con generazione automatica di proposte
pasto via AI. Progetto a **singolo utente**, pensato per uso personale su iPhone e desktop.

Questo documento è diviso in due parti:

- **[Parte 1 — Guida tecnica](#parte-1--guida-tecnica)**, per chi lavora sul codice.
- **[Parte 2 — Guida utente](#parte-2--guida-utente)**, per chi usa l'app.

---

# Parte 1 — Guida tecnica

## 1.1 Stack

- **Next.js 14** (App Router), **TypeScript** strict, **Tailwind CSS**
- **Supabase** (solo Postgres — nessun uso di Supabase Auth)
- **OpenRouter** come gateway AI per il generatore di pasti (nessuna chiamata diretta a
  OpenAI/Anthropic/Google)
- Deploy previsto su **Vercel**
- Nessuna libreria di UI/charting esterna: tutti i grafici sono SVG scritti a mano
  (vedi `app/_dashboard/TrendChart.tsx`, `app/misure/bussola/CompositionTrendChart.tsx`)

## 1.2 Decisione architetturale fondamentale: niente login

IterUp **non ha autenticazione**. È un'app a singolo utente:

- Un solo record in `auth.users`, il cui `id` è hardcoded in `.env.local` come
  `CURRENT_USER_ID` e riesportato da `lib/config.ts`.
- **Ogni** query, in **ogni** API route, filtra esplicitamente `.eq("user_id", CURRENT_USER_ID)`
  invece di appoggiarsi a `auth.uid()` o a una sessione.
- Le API route usano `lib/supabase/server.ts`, un client Supabase con la **service role
  key**, che bypassa le Row Level Security policy. Le RLS policy in `schema.sql` esistono
  comunque come difesa in profondità, nel caso in futuro si introduca un client anon
  lato browser.
- **Nessun componente client (`"use client"`) importa mai la service role key.** Solo i
  file sotto `app/api/**/route.ts` la usano.

Se in futuro serve un vero sistema multi-utente, è un cambio isolato a
`lib/config.ts`/`lib/supabase/server.ts`, non tocca i moduli funzionali.

### 1.2.1 Protezione delle API route (token condiviso)

"Niente login" non significava "nessun controllo": fino a un certo punto del progetto,
**ogni** API route era raggiungibile da chiunque conoscesse l'URL dell'app deployata,
perché ogni route usa la service role key server-side a prescindere da chi ha fatto la
richiesta. Le Row Level Security policy in `schema.sql` **non aiutano qui**: sono legate
al ruolo Postgres della connessione, e la service role bypassa le RLS per design — quindi
sono difesa in profondità solo per lo scenario (oggi non presente) in cui un client
browser usasse la anon key direttamente contro Supabase, non per il traffico reale
dell'app, che passa sempre dalle API route.

La protezione reale è `lib/api-auth.ts`: ogni API route (lettura e scrittura) chiama
`requireApiAuth(request)` e risponde `401` senza un token valido, letto da header
`x-api-token` o query param `?token=`. Il client (l'app stessa) allega il token
automaticamente tramite `lib/api-client.ts` (`apiFetch`, da usare al posto di `fetch()`
nudo per ogni chiamata verso `/api/**`). Il token vive in due variabili d'ambiente con lo
stesso valore — `API_WRITE_SECRET` (letta solo server-side) e
`NEXT_PUBLIC_API_WRITE_TOKEN` (nel bundle client, perché il client deve poterlo allegare)
— quindi non è un segreto crittografico forte (visibile a chi ispetta la scheda Network),
ma alza l'asticella da "chiunque conosca l'URL" a "chiunque ispezioni il traffico", nello
stesso spirito del webhook `ACTIVITY_WEBHOOK_SECRET` già esistente per gli Shortcuts iOS.

Due eccezioni deliberate, senza token:

- `POST /api/activity/ingest` — protetta da un secret **diverso** (`ACTIVITY_WEBHOOK_SECRET`),
  perché è chiamata da uno Shortcut iOS esterno, non dal client dell'app.
- `GET /api/reminders/status` — nessun token: pensata per essere interrogata da uno
  Shortcut iOS pianificato, e il payload non contiene mai dati personali (solo booleani
  "manca X oggi?").

Protezione reale aggiuntiva prevista ma non ancora attiva: **Vercel Deployment
Protection**, una volta fatto il deploy.

## 1.3 Struttura del repository

```
app/
  page.tsx                    Home = dashboard (redirige a /impostazioni se il profilo non esiste)
  layout.tsx                  Shell globale, nav, PWA metadata
  _dashboard/                 Componenti della dashboard (prefisso _ = non è una route)
  diario/                     Diario alimentare + generatore pasti AI
    components/
  misure/                     Peso/misure + Bussola di Ricomposizione (tab)
    bussola/
  abitudini/                  CRUD abitudini + log giornaliero
  obiettivi/                  CRUD obiettivi generalizzati
  attivita/                   Attività fisica (passi + allenamenti)
  impostazioni/                Profilo (anche primo avvio) + integratori/chat + backup + preferenze coach
  api/                        Tutte le API route server-side (vedi 1.5)
components/
  nav/                        Navigazione (bottom nav mobile / sidebar desktop)
lib/                          Logica condivisa, vedi 1.4
public/                       manifest.json, service worker, icone PWA
schema.sql                    Schema DB canonico (stato TARGET, non applicato in automatico)
schema-migration-*.sql        Migrazioni incrementali, da eseguire a mano su Supabase
PRD-*.md                      Documenti di specifica (vedi 1.8)
CLAUDE.md                     Regole operative per lavorare sul progetto con Claude Code
```

## 1.4 Moduli in `lib/`

| File | Scopo |
|---|---|
| `config.ts` | `CURRENT_USER_ID` — contratto congelato |
| `supabase/server.ts` | Client Supabase service-role — contratto congelato |
| `types.ts` | Tipi TypeScript di tutte le tabelle (formato `Database`, stile `supabase gen types`) — contratto congelato |
| `design-tokens.ts` | Palette colori/spacing/font condivisi — contratto congelato |
| `nutrition-options.ts` | Fonte unica per: tipi di dieta, regimi alimentari (con split macro per regime), tipi di pasto |
| `tdee.ts` | Formula di Mifflin-St Jeor (BMR/TDEE), calcolo target kcal/macro |
| `body-indices.ts` | BMI e "Indice Corporeo IterUp" (indice composito peso+circonferenze) |
| `composition.ts` | Formule della Bussola di Ricomposizione (BF% Navy, FM/FFM, bilancio energetico, Indice di Ricomposizione, logica di direzione) |
| `body-metrics-store.ts` | Upsert "merge-aware" su `body_metrics`, condivisa tra modulo Misure e Bussola |
| `openrouter.ts` | Client OpenRouter condiviso (fallback esplicito tra modelli, mai auto-router) |
| `api-auth.ts` | `requireApiAuth(request)` — guardia token per ogni API route, vedi 1.2.1 |
| `api-client.ts` | `apiFetch()` — wrapper client che allega il token, da usare al posto di `fetch()` nudo |
| `streak.ts` | Calcolo streak (giorni consecutivi completati), condiviso tra dashboard e obiettivi |
| `goal-progress.ts` | `current_value`/`progress_pct` degli obiettivi, calcolati a runtime dai dati reali, mai persistiti |
| `offline-queue.ts` | Coda IndexedDB per i log del diario quando manca rete (retry automatico al ritorno online) |
| `coach-triggers.ts` | Coach comportamentale: rilevamento pattern, funzioni pure e testate (vedi 1.11) |
| `coach-messages.ts` | Coach comportamentale: prompt e chiamate OpenRouter per nudge/rituali mattina-sera |
| `coach-engine.ts` | Coach comportamentale: switch on/off, cap di frequenza, ciclo di feedback 👍/👎 |
| `coach-evaluators.ts` | Coach comportamentale: legge i dati reali e collega trigger + engine ai punti di scrittura |

I file marcati "contratto congelato" non vanno modificati senza motivo esplicito: sono la
superficie di contatto tra i moduli (vedi `CLAUDE.md`).

## 1.5 API route (convenzione: `app/api/<modulo>/<azione>/route.ts`)

Tutte le route sotto `/api/**` richiedono il token condiviso (vedi 1.2.1), tranne le due
eccezioni deliberate segnalate lì.

| Modulo | Route | Note |
|---|---|---|
| Profilo | `GET/POST /api/profile` | Legge/salva profilo, ricalcola TDEE e target ad ogni salvataggio |
| Diario | `GET /api/foods/search`, `POST /api/foods`, `GET /api/foods/search-external` | Ricerca full-text → ilike → trigram (typo-tolerante); import da Open Food Facts su richiesta esplicita |
| Diario | `GET/POST /api/logs`, `DELETE /api/logs/[id]`, `GET /api/logs/summary` | CRUD log pasti, riepilogo macro giornaliero, guardrail soft su quantità/kcal anomale |
| Generatore AI | `POST /api/suggest-meal`, `POST /api/suggest-meal/feedback` | 5 proposte pasto via OpenRouter, voto 👍/👎 |
| Misure | `GET/POST /api/body-metrics`, `DELETE /api/body-metrics/[id]` | Storico peso/circonferenze |
| Bussola | `GET /api/composition`, `POST /api/composition/checkin` | Calcolo direzione + salvataggio check-in |
| Abitudini | `GET/POST /api/habits`, `PATCH/DELETE /api/habits/[id]`, `GET/POST /api/habits/log` | CRUD + log giornaliero |
| Obiettivi | `GET/POST /api/goals`, `PATCH/DELETE /api/goals/[id]` | CRUD, `current_value`/`progress_pct` calcolati a runtime, valuta anche il trigger "obiettivo in ritardo" del coach |
| Attività | `POST /api/activity/ingest`, `POST /api/activity/create`, `GET /api/activity/list`, `DELETE /api/activity/delete` | Webhook Shortcuts (secret dedicato) + form manuale |
| Integratori | `GET/POST /api/supplements`, `PATCH/DELETE /api/supplements/[id]` | CRUD |
| Integratori | `GET/POST /api/supplements/chat` | Chat Q&A con web search grounding obbligatorio, citazioni cliccabili |
| Dashboard | `GET /api/dashboard`, `GET /api/dashboard/timeline` | Aggrega gli indicatori della home + vista cronologica (peso/kcal/attività/abitudini) |
| Backup | `GET /api/export` | Esporta in JSON tutti i dati dell'utente (profilo, diario, misure, attività, abitudini, obiettivi, integratori) |
| Promemoria | `GET /api/reminders/status` | Booleani "manca X oggi?", per uno Shortcut iOS pianificato — nessun dato personale, nessun token |
| Coach | `GET /api/coach/nudges`, `POST /api/coach/nudges/[id]/feedback` | Ultimi nudge generati + reazione 👍/👎/silenzia |
| Coach | `GET/PATCH /api/coach/preferences` | Switch on/off e tono preferito per categoria di trigger |
| Coach | `GET/POST /api/coach/daily-focus`, `GET/POST /api/coach/journal` | Le 3 priorità del giorno, "Note del giorno" |
| Coach | `GET /api/coach/morning`, `GET /api/coach/evening` | Rituali per Shortcut iOS pianificato (mattina/sera) |

## 1.6 Schema database

`schema.sql` è la fonte di verità dello **stato target** (non riflette necessariamente ciò
che è applicato sul DB live in questo istante: vedi 1.7). Tabelle:

| Tabella | Scopo |
|---|---|
| `profiles` | Dati fisici, regime alimentare, allergie, preferenze |
| `user_targets` | Storico target kcal/macro (una riga attiva alla volta, `is_active`) |
| `foods` | Catalogo alimenti condiviso (~180 curati da USDA + voci aggiunte manualmente, `source`) |
| `daily_logs` | Log pasti — macro salvati come **snapshot** al momento del log, non ricalcolati |
| `body_metrics` | Peso/circonferenze, condivisa tra Misure e Bussola (un record al giorno) |
| `activity_logs` | Passi e allenamenti |
| `habits` / `habit_logs` | Abitudini e log giornaliero |
| `goals` | Obiettivi generalizzati (peso, streak abitudine, attività, custom) |
| `supplements` | Integratori posseduti |
| `meal_suggestion_feedback` | Voti sulle proposte pasto AI |
| `supplement_chat_messages` | Cronologia della chat Q&A sugli integratori, con citazioni web |
| `coach_nudges` | Ogni messaggio generato dal coach comportamentale (trigger, dati grezzi, reazione) |
| `coach_preferences` | Switch on/off, tono preferito e tasso di gradimento per categoria di trigger |
| `daily_focus` | Le 3 priorità della giornata (rituale mattutino del coach) |
| `journal_entries` | "Note del giorno" — testo libero letto (non interpretato) dal rituale serale del coach |

Dettagli importanti che si discostano da un modello "naive":

- **`daily_logs.food_id` e `quantity_g` sono nullable**: i tipi di pasto `digiuno` e
  `integrazione` non hanno un alimento associato.
- **`user_targets.mode`** è una lista aperta di tipi di dieta
  (dimagrimento/mantenimento/costruzione_muscolare/recupero), scelta direttamente
  dall'utente — non derivata dal delta peso/obiettivo.
- **`profiles.dietary_regime`** è testo libero (nessun `CHECK` in DB): i preset noti
  (con split macro fisso, es. Keto 10/35/55) vivono solo in `lib/nutrition-options.ts`,
  l'utente può aggiungerne di nuovi da UI. Un regime **non** tra i preset usa uno split
  generico 45% carbo/30% proteine/25% grassi, a meno che l'utente non ne definisca uno
  suo in `profiles.custom_macro_split` (jsonb `{carbPct,proteinPct,fatPct}`, somma 100,
  validato da `isValidMacroSplit` sia client che server) — vedi il form in
  `app/impostazioni/ProfileForm.tsx`, visibile solo quando il regime attivo è custom.
- **`body_metrics`** ha sia i campi "Misure" (peso, collo, petto, vita, coscia) sia i
  campi "Bussola" (fianchi, polso, kcal periodo, percezione soggettiva collo/polso,
  `sex_at_checkin` — snapshot del sesso al momento del check-in). L'upsert è
  **merge-aware** (`lib/body-metrics-store.ts`): un form non cancella i campi scritti
  dall'altro per lo stesso giorno.
- **Ricerca alimenti a 3 livelli**: full-text → `ilike` → estensione `pg_trgm` (tolleranza
  ai typo) via una funzione RPC dedicata (`search_foods_trgm`, PostgREST non permette di
  ordinare per `similarity()` direttamente dal query builder).

## 1.7 Migrazioni: come sincronizzare lo schema

`schema.sql` contiene sempre `create table if not exists`, quindi **non altera** le
tabelle già esistenti su un DB popolato. Ogni cambio incrementale allo schema vive in un
file `schema-migration-NNN-<nome>.sql` separato, da eseguire **manualmente** nell'SQL
Editor di Supabase (nessun accesso diretto del supervisore al DB per operazioni DDL: la
service role key permette solo query REST, non DDL).

Ordine di applicazione, se si parte da zero: `schema.sql`, poi `schema-migration-002-*`
fino a `008-*` in ordine numerico. Ogni file ha in testa un commento che descrive cosa
cambia. Riepilogo di cosa introduce ciascuna migrazione:

| Migrazione | Introduce |
|---|---|
| `002-addendum` | Campi onboarding (regime, allergie, preferenze), digiuno/integrazione |
| `003` | Split macro per regime alimentare |
| `004-bussola` | Bussola di Ricomposizione: fianchi, kcal periodo, percezioni collo/polso |
| `005-polso` | Campo `wrist_cm` (contesto, fuori dal calcolo BF%/IR) |
| `006-trgm` | Estensione `pg_trgm` + funzione `search_foods_trgm` |
| `007-supplement-chat` | Tabella `supplement_chat_messages` |
| `008-coach` | Tabelle `coach_nudges`, `coach_preferences`, `daily_focus`, `journal_entries` |
| `009-custom-macro-split` | Campo `profiles.custom_macro_split`, split macro personalizzato per regimi custom |

## 1.8 Documenti di riferimento

- `CLAUDE.md` — regole operative per Claude Code (contratti congelati, workflow multi-agente)
- `iterup_PRD_multiagente.md` — PRD originale, stack e architettura agenti Fase 0-4
- `PRD-addendum-onboarding-form.md` — regime/allergie/preferenze, digiuno/integrazione, integratori
- `PRD-addendum-openrouter.md` — vincoli sul motore AI (modelli, fallback, schema JSON)
- `PRD-addendum-bussola-ricomposizione.md` — Bussola di Ricomposizione Corporea
- `PRD-addendum-hardening-completamento.md` — test, guardrail, coda offline, ricerca
  tollerante ai typo, obiettivi collegati ai dati, export, vista cronologica, chat
  integratori, promemoria
- `PRD-addendum-coach-comportamentale.md` — motore di nudge, rituali mattina/sera

## 1.9 Variabili d'ambiente (`.env.local`, mai committato)

| Variabile | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave anon (non usata lato server, presente per eventuali usi client futuri) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service-role, solo server-side |
| `CURRENT_USER_ID` | UUID dell'unico utente dell'app |
| `ACTIVITY_WEBHOOK_SECRET` | Shared secret per il webhook Shortcuts iOS (`/api/activity/ingest`) |
| `OPENROUTER_API_KEY` | Chiave OpenRouter per generatore pasti, chat integratori, coach |
| `API_WRITE_SECRET` | Token di protezione delle API route, letto solo server-side (vedi 1.2.1) |
| `NEXT_PUBLIC_API_WRITE_TOKEN` | Stesso valore di `API_WRITE_SECRET`, nel bundle client perché il client deve allegarlo |

## 1.10 Sviluppo locale

```bash
npm install
npm run dev       # sviluppo, http://localhost:3000
npm run build     # build di produzione — deve sempre passare prima di considerare
                   # una modifica completa (vedi CLAUDE.md)
npm run start     # avvia la build di produzione in locale
npm test          # esegue la suite Vitest (funzioni pure: tdee, composition,
                   # body-indices, nutrition-options, streak, coach-triggers)
```

## 1.11 Coach Comportamentale

Motore di **nudge comportamentali**, non un sistema che "impara la psicologia"
dell'utente in senso forte: con i dati di un solo utente non c'è segnale sufficiente per
un modello che apprende pattern individuali complessi. È deliberatamente composto da
regole esplicite + un layer LLM che scrive il messaggio nel tono giusto + un ciclo di
feedback semplice (non machine learning), vedi `PRD-addendum-coach-comportamentale.md`.

**Motore di trigger** (`lib/coach-triggers.ts`, funzioni pure e testate) — 6 pattern:
peso stabile/sceso poco, pattern orario di fame ricorrente, abitudine saltata (solo al
primo salto), obiettivo in ritardo sul ritmo necessario, pasto molto sopra target,
streak a 7/30/90 giorni. Valutati inline subito dopo le scritture esistenti
(`lib/coach-evaluators.ts` collega i dati reali ai trigger, chiamato da
`POST /api/logs`, `POST /api/body-metrics`, `POST /api/habits/log`, `GET /api/goals`),
mai come processo separato: nessuna infrastruttura nuova.

**Guardrail**: switch on/off per categoria (`coach_preferences.enabled`), cap di
frequenza per categoria (`lib/coach-engine.ts`, es. max 1 nudge "peso" a settimana anche
loggando ogni giorno), nessun nudge "pasto sopra target" senza almeno 14 giorni di
storico. Ogni chiamata è **best-effort**: un errore nel coach non fa mai fallire la
scrittura principale (log, misurazione, ecc.).

**Ciclo di feedback** (non ML): ogni nudge ha 👍/👎/silenzia. Il tasso di gradimento
aggregato per categoria allunga automaticamente il cap di frequenza sotto il 50%, e
disattiva la categoria sotto il 20% (con almeno 3 reazioni, per non disattivare da un
singolo 👎 isolato). Il tono (diretto/pratico vs. riflessivo) si salva su quello con più
👍 tra le varianti usate.

**Rituali mattina/sera** (`GET /api/coach/morning`, `GET /api/coach/evening`), pensati
per uno Shortcut iOS pianificato che legge la risposta via Siri o notifica locale — non
c'è infrastruttura push nuova. Il mattino risponde sempre con 3 componenti (riflessione
originale mai con citazioni a persone reali, le 3 priorità da `daily_focus` o dedotte da
obiettivi/abitudini, un'abitudine da ricordare). La sera riassume la giornata e chiude
con un tono calmo, mai una checklist di correzioni; se le "Note del giorno"
(`journal_entries`) contengono segnali di disagio, il modello stesso resta più sobrio
senza interpretarli — non c'è una fase di rilevamento separata nel codice.

---

# Parte 2 — Guida utente

## 2.1 Cos'è IterUp

IterUp è la tua app personale per tenere sotto controllo dieta, peso, attività fisica e
abitudini in un unico posto, senza dover usare quattro app diverse e senza dover creare
un account: è già impostata per te.

## 2.2 Primo avvio

Alla prima apertura ti viene chiesto di completare il profilo (**Impostazioni**): nome,
sesso, data di nascita, altezza, peso attuale, livello di attività quotidiana, tipo di
dieta che vuoi seguire, regime alimentare, eventuali allergie e preferenze. Da questi dati
IterUp calcola subito il tuo fabbisogno calorico e i tuoi target di macronutrienti.

Questi dati **non sono definitivi**: puoi tornare in Impostazioni in qualsiasi momento
per aggiornarli (es. dopo aver perso peso, o se cambi obiettivo).

Se scegli uno dei regimi alimentari già noti (mediterraneo, keto, paleo, vegano...),
IterUp divide le tue calorie in carbo/proteine/grassi con le percentuali giuste per
quello stile alimentare. Se invece scrivi un regime tuo personalizzato con "+ Aggiungi
nuovo regime...", compare un campo per specificare tu le percentuali (devono sommare a
100%); se lo lasci vuoto, IterUp usa un mix generico bilanciato — che potrebbe non avere
senso per un regime molto sbilanciato (es. chetogenico) se non lo specifichi tu.

## 2.3 Home (dashboard)

La schermata principale riassume tutto lo stato attuale:

- **Peso**: peso attuale, obiettivo, quanti kg mancano, il trend delle ultime settimane e
  — se il trend va nella direzione giusta — una stima di quando raggiungerai l'obiettivo,
  con grafico storico.
- **Composizione corporea**: BMI con categoria, e l'**Indice Corporeo IterUp**, un
  indicatore che combina peso e circonferenze per seguire la ricomposizione corporea in
  modo più stabile del solo peso (che oscilla per acqua/glicogeno).
- **Target di oggi**: il tuo metabolismo basale (BMR), il fabbisogno di mantenimento
  (TDEE) e il tuo obiettivo calorico reale, più le barre di avanzamento di
  kcal/proteine/carboidrati/grassi consumati oggi.
- **Abitudini**: streak corrente di ogni abitudine attiva e quanto manca ai 90 giorni per
  considerarla "acquisita".
- **Attività**: passi di oggi/settimana/mese, allenamenti della settimana.
- **Obiettivi in corso**: con barra di avanzamento per quelli legati al peso.
- **Il tuo coach oggi**: i messaggi che il coach comportamentale ti ha lasciato (vedi
  2.9), più due form rapidi per le priorità della giornata e le note personali.
- **Cronologia**: un'unica vista con peso, aderenza calorica, abitudini completate e
  minuti di attività fianco a fianco sulla stessa scala temporale (7/30/90 giorni).

## 2.4 Diario alimentare

Cerca un alimento (ricerca in italiano, oltre 180 alimenti già disponibili — la ricerca
tollera anche piccoli errori di battitura). Non lo trovi? Puoi **aggiungerlo tu** al
database con i suoi valori nutrizionali per 100g, oppure cercarlo nel database pubblico
Open Food Facts e importarlo con un tap. Scegli quantità e pasto
(colazione/pranzo/cena/spuntino) e salvalo: le calorie e i macro vengono calcolati
automaticamente. Se inserisci per sbaglio un valore fuori scala (es. 1000g invece di
100g), l'app te lo segnala senza bloccare comunque il salvataggio.

Puoi anche registrare un **digiuno** con un tasto rapido, senza dover selezionare un
alimento.

Se salvi un log senza connessione, resta visibile come "in sincronizzazione" e viene
inviato automaticamente non appena torni online: non perdi mai un log per assenza di
rete.

### Suggerimenti pasto con AI

Premi "✨ Suggerisci con AI" per ricevere 5 proposte di pasto generate su misura, che
tengono conto di:
- il tuo obiettivo calorico per quel pasto specifico
- il regime alimentare che segui (es. keto, mediterraneo, vegano...)
- le tue allergie (**mai violate**) e le tue preferenze di gusto
- solo alimenti realmente presenti nel database, con macro ricalcolati sui valori reali

Puoi aggiungere una proposta al diario con un tasto, e votarla 👍/👎 per aiutare a
capire quali proposte funzionano meglio per te nel tempo.

## 2.5 Misure e Bussola di Ricomposizione

La sezione **Misure** ha due schede:

- **Misure**: inserisci peso e circonferenze (collo, petto, vita, coscia), con lo storico
  di tutte le misurazioni passate.
- **Bussola**: una lettura più raffinata di dove sta andando davvero il tuo corpo, utile
  soprattutto nei periodi in cui il peso resta stabile ma la composizione sta comunque
  cambiando (perdi grasso e guadagni muscolo, o viceversa). Registrando un check-in
  (peso, collo, vita, fianchi se sei donna, e opzionalmente petto/coscia/polso e le kcal
  mangiate dall'ultimo check-in) ottieni:
  - una **bussola visuale** con un ago che indica la direzione: sei in ricomposizione
    ideale, in un surplus pulito, stai accumulando grasso, o — attenzione — stai perdendo
    muscolo insieme al grasso?
  - un **breakdown numerico completo e sempre visibile**: bilancio calorico del periodo,
    variazione di peso attesa vs reale, variazione di massa grassa e magra
  - un grafico dell'andamento di massa grassa, massa magra e peso nel tempo

  Servono **almeno due check-in** perché la bussola si attivi (il primo stabilisce solo
  il punto di partenza).

## 2.6 Abitudini

Crea abitudini di due tipi: **sì/no** (es. "bere 2L di acqua") o **quantità** (es. "10.000
passi", con un valore target). Segnale ogni giorno dalla pagina Abitudini o dalla
dashboard. IterUp tiene traccia dello streak (giorni consecutivi) e lo mostra come
avanzamento verso i 90 giorni, la soglia comunemente associata al consolidamento di
un'abitudine.

## 2.7 Obiettivi

Crea obiettivi generici — di peso, legati a una streak di abitudine, di attività fisica,
o personalizzati — con un valore target e, se vuoi, una data. Segui lo stato (in corso,
raggiunto, abbandonato) dalla pagina dedicata o dalla dashboard.

## 2.8 Attività fisica

Registra manualmente i tuoi allenamenti (tipo, durata, calorie bruciate) dalla pagina
Attività. Se usi un iPhone, puoi anche automatizzare l'invio dei passi giornalieri con
uno **Shortcut** che chiama l'endpoint webhook dell'app (serve una chiave segreta,
configurata una volta sola).

## 2.9 Il tuo coach comportamentale

IterUp osserva i tuoi dati (peso, pasti, abitudini, obiettivi) e a volte ti lascia un
breve messaggio — mai un giudizio su un singolo giorno, mai in tono colpevolizzante, e
mai vuota retorica motivazionale senza un dato o un'azione concreta dentro. Ogni
messaggio ha un 👍, un 👎 e un "silenzia questo tipo": se un certo tipo di messaggio non
ti è utile, IterUp riduce da solo quanto spesso te lo mostra, e lo disattiva del tutto se
continua a non piacerti.

Nella dashboard puoi anche:

- scrivere le **3 priorità della giornata** (usate dal rituale del mattino, se lo
  configuri — vedi sotto);
- scrivere una **nota personale del giorno** ("Note del giorno"), diversa dal diario
  alimentare — letta solo dal riepilogo serale, mai analizzata o commentata nel merito.

Se usi un iPhone, puoi configurare due **Shortcut iOS pianificati** (uno al mattino, uno
alla sera) che chiamano rispettivamente `/api/coach/morning` e `/api/coach/evening` e ti
leggono via Siri o mostrano una notifica: una riflessione + le tue priorità + un
promemoria su un'abitudine al mattino, un riepilogo calmo della giornata alla sera.
Richiedono la stessa chiave segreta usata per proteggere le altre funzioni dell'app
(configurata una volta sola nello Shortcut).

## 2.10 Impostazioni

Oltre a modificare il tuo profilo in qualsiasi momento, questa è anche la sezione dove:

- gestisci l'elenco degli **integratori** che possiedi (nome, dosaggio, formato);
- fai domande libere sui tuoi integratori a una **chat con ricerca web**, che etichetta
  sempre ogni affermazione come evidenza scientifica o anedottica e cita le fonti che ha
  trovato — non sostituisce un parere medico;
- attivi o disattivi i singoli tipi di messaggio del **coach comportamentale**;
- scarichi un **backup completo** di tutti i tuoi dati in un file JSON.

## 2.11 Cosa NON fa (per ora)

- Non genera automaticamente un piano dietetico per integratori (solo il diario pasti ha
  il generatore AI, per ora).
- Non è uno strumento clinico: il coach comportamentale non interpreta, non etichetta e
  non fa diagnosi su ciò che scrivi nelle note personali — se percepisce un tono più
  serio si limita a essere più sobrio quella sera, nient'altro.
- Non supporta più utenti: è pensata per un solo profilo.
