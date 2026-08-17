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
  impostazioni/                Profilo utente (anche primo avvio) + integratori
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

I file marcati "contratto congelato" non vanno modificati senza motivo esplicito: sono la
superficie di contatto tra i moduli (vedi `CLAUDE.md`).

## 1.5 API route (convenzione: `app/api/<modulo>/<azione>/route.ts`)

| Modulo | Route | Note |
|---|---|---|
| Profilo | `GET/POST /api/profile` | Legge/salva profilo, ricalcola TDEE e target ad ogni salvataggio |
| Diario | `GET /api/foods/search`, `POST /api/foods` | Ricerca full-text italiana + creazione manuale alimenti |
| Diario | `GET/POST /api/logs`, `DELETE /api/logs/[id]`, `GET /api/logs/summary` | CRUD log pasti, riepilogo macro giornaliero |
| Generatore AI | `POST /api/suggest-meal`, `POST /api/suggest-meal/feedback` | 5 proposte pasto via OpenRouter, voto 👍/👎 |
| Misure | `GET/POST /api/body-metrics`, `DELETE /api/body-metrics/[id]` | Storico peso/circonferenze |
| Bussola | `GET /api/composition`, `POST /api/composition/checkin` | Calcolo direzione + salvataggio check-in |
| Abitudini | `GET/POST /api/habits`, `PATCH/DELETE /api/habits/[id]`, `POST /api/habits/log` | CRUD + log giornaliero |
| Obiettivi | `GET/POST /api/goals`, `PATCH/DELETE /api/goals/[id]` | CRUD generalizzato |
| Attività | `POST /api/activity/ingest`, `POST /api/activity/create`, `GET /api/activity/list`, `DELETE /api/activity/delete` | Webhook Shortcuts + form manuale |
| Integratori | `GET/POST /api/supplements`, `PATCH/DELETE /api/supplements/[id]` | CRUD |
| Dashboard | `GET /api/dashboard` | Aggrega tutti gli indicatori della home |

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

Dettagli importanti che si discostano da un modello "naive":

- **`daily_logs.food_id` e `quantity_g` sono nullable**: i tipi di pasto `digiuno` e
  `integrazione` non hanno un alimento associato.
- **`user_targets.mode`** è una lista aperta di tipi di dieta
  (dimagrimento/mantenimento/costruzione_muscolare/recupero), scelta direttamente
  dall'utente — non derivata dal delta peso/obiettivo.
- **`profiles.dietary_regime`** è testo libero (nessun `CHECK` in DB): i preset noti
  vivono solo in `lib/nutrition-options.ts`, l'utente può aggiungerne di nuovi da UI.
- **`body_metrics`** ha sia i campi "Misure" (peso, collo, petto, vita, coscia) sia i
  campi "Bussola" (fianchi, polso, kcal periodo, percezione soggettiva collo/polso,
  `sex_at_checkin` — snapshot del sesso al momento del check-in). L'upsert è
  **merge-aware** (`lib/body-metrics-store.ts`): un form non cancella i campi scritti
  dall'altro per lo stesso giorno.

## 1.7 Migrazioni: come sincronizzare lo schema

`schema.sql` contiene sempre `create table if not exists`, quindi **non altera** le
tabelle già esistenti su un DB popolato. Ogni cambio incrementale allo schema vive in un
file `schema-migration-NNN-<nome>.sql` separato, da eseguire **manualmente** nell'SQL
Editor di Supabase (nessun accesso diretto del supervisore al DB per operazioni DDL: la
service role key permette solo query REST, non DDL).

Ordine di applicazione, se si parte da zero: `schema.sql`, poi `schema-migration-002-*`,
`003`, `004`, `005` in ordine numerico. Ogni file ha in testa un commento che descrive
cosa cambia.

## 1.8 Documenti di riferimento

- `CLAUDE.md` — regole operative per Claude Code (contratti congelati, workflow multi-agente)
- `iterup_PRD_multiagente.md` — PRD originale, stack e architettura agenti Fase 0-4
- `PRD-addendum-onboarding-form.md` — regime/allergie/preferenze, digiuno/integrazione, integratori
- `PRD-addendum-openrouter.md` — vincoli sul motore AI (modelli, fallback, schema JSON)
- `PRD-addendum-bussola-ricomposizione.md` — Bussola di Ricomposizione Corporea

## 1.9 Variabili d'ambiente (`.env.local`, mai committato)

| Variabile | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave anon (non usata lato server, presente per eventuali usi client futuri) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service-role, solo server-side |
| `CURRENT_USER_ID` | UUID dell'unico utente dell'app |
| `ACTIVITY_WEBHOOK_SECRET` | Shared secret per il webhook Shortcuts iOS |
| `OPENROUTER_API_KEY` | Chiave OpenRouter per il generatore pasti AI |

## 1.10 Sviluppo locale

```bash
npm install
npm run dev       # sviluppo, http://localhost:3000
npm run build     # build di produzione — deve sempre passare prima di considerare
                   # una modifica completa (vedi CLAUDE.md)
npm run start     # avvia la build di produzione in locale
```

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

## 2.4 Diario alimentare

Cerca un alimento (ricerca in italiano, oltre 180 alimenti già disponibili), scegli
quantità e pasto (colazione/pranzo/cena/spuntino), e salvalo: le calorie e i macro
vengono calcolati automaticamente. Non trovi un alimento? Puoi **aggiungerlo tu** al
database con i suoi valori nutrizionali per 100g.

Puoi anche registrare un **digiuno** con un tasto rapido, senza dover selezionare un
alimento.

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

## 2.9 Impostazioni

Oltre a modificare il tuo profilo in qualsiasi momento, questa è anche la sezione dove
gestisci l'elenco dei **integratori** che possiedi (nome, principio attivo/dosaggio,
formato) — utile come base per future funzioni di consiglio automatico e per una chat
dedicata alle domande sugli integratori (in arrivo).

## 2.10 Cosa NON fa (per ora)

- Non genera automaticamente un piano dietetico per integratori (solo il diario pasti ha
  il generatore AI, per ora).
- Non ha una chat AI per domande libere (es. sugli integratori) — prevista come sviluppo
  futuro.
- Non supporta più utenti: è pensata per un solo profilo.
