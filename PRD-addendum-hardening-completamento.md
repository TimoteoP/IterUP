# Addendum PRD — IterUp: Hardening, Efficientamento e Funzioni Mancanti

Questo documento integra `iterup_PRD_multiagente.md` e va letto insieme a `CLAUDE.md`
(regole non negoziabili, contratti congelati). Nasce dall'analisi dello stato attuale del
repository (v0.1.0, ~5.300 righe TSX, 23 API route, 5 migrazioni applicate) e ordina il
lavoro in due parti: prima consolidare quello che c'è, poi aggiungere ciò che manca.

## 0. Scope e non-goals

- **Fuori scope in questo addendum: login/autenticazione utente.** Resta valida la
  decisione di `CLAUDE.md` regola 1 — nessun agente crea schermate di login, signup,
  reset password o gestione sessione. Questo non è un rinvio per pigrizia: è una scelta
  architetturale esplicita che si rivede altrove, se e quando servirà.
- Vincoli ereditati da `CLAUDE.md` restano tutti validi: non modificare i contratti
  congelati (`schema.sql`, `lib/types.ts`, `lib/supabase/server.ts`, `lib/config.ts`,
  `lib/design-tokens.ts`) senza autorizzazione esplicita; ogni cambio di schema va in un
  nuovo file `schema-migration-NNN-<nome>.sql`, mai riscrivendo `schema.sql` a mano; ogni
  modifica deve passare `npm run build` prima di essere considerata completa.
- Ordine di esecuzione: **Parte A prima di Parte B**, sempre. Aggiungere funzioni nuove
  sopra fondamenta non testate e senza rete di sicurezza (backup, coda offline) moltiplica
  il rischio invece di ridurlo.

---

## Parte A — Hardening ed efficientamento (priorità)

### A1. Copertura di test sulle funzioni di calcolo pure

**Problema**: `lib/tdee.ts`, `lib/composition.ts`, `lib/body-indices.ts` e
`lib/nutrition-options.ts` sono funzioni pure — perfette da testare — ma non esiste un
solo file di test nel repo. Il bug storico delle ~462g proteine/giorno è stato scoperto
solo guardando un numero assurdo in dashboard, non da una rete di sicurezza automatica.

**Lavoro**:
- Aggiungere **Vitest** come devDependency (leggero, nessuna dipendenza da browser/DOM,
  compatibile con Next 14 + TypeScript strict). Script `"test": "vitest run"` in
  `package.json`.
- `lib/__tests__/tdee.test.ts`:
  - BMR uomo/donna con valori di riferimento noti calcolati a mano.
  - Ogni `ACTIVITY_MULTIPLIERS` applicato correttamente al BMR.
  - `MODE_KCAL_ADJUSTMENT` con segno corretto per ciascuna delle 4 modalità
    (dimagrimento negativo, costruzione_muscolare/recupero positivi, mantenimento zero).
  - `calculateAge` su casi limite: compleanno oggi, 29 febbraio, data nel futuro (deve
    comunque restituire un numero, non NaN).
- `lib/__tests__/nutrition-options.test.ts`:
  - Ogni voce di `REGIME_MACRO_SPLITS` somma esattamente a 100 (carb+protein+fat pct).
  - `macroSplitForRegime` su un regime custom non presente ritorna
    `DEFAULT_MACRO_SPLIT`, non `undefined`.
- `lib/__tests__/composition.test.ts`:
  - BF% Navy per un caso uomo e un caso donna con valori verificabili contro una
    calcolatrice di riferimento pubblica.
  - I 4 quadranti della bussola (ricomposizione ideale, surplus pulito, accumulo grasso,
    perdita muscolo) prodotti con input costruiti apposta per cadere in ciascuno.
- `lib/__tests__/body-indices.test.ts`: BMI e Indice Corporeo IterUp su 2-3 casi noti.

**Criteri di accettazione**:
- `npm test` verde su tutti i file sopra.
- Nessuna funzione di calcolo priva di almeno un test che ne verifichi l'output atteso.
- Non tocca `schema.sql` né alcun contratto congelato: solo `lib/` + nuova devDependency.

### A2. Test di regressione mirato sul bug storico del calcolo macro

**Lavoro**:
- Un test esplicito in `lib/__tests__/tdee.test.ts` che riproduce lo scenario che ha
  causato le ~462g proteine/giorno (documentato come "errore upstream nella formula di
  split macro" — ricostruire l'input che lo generava e fissarlo come caso di test), così
  che una futura modifica a `tdee.ts` o `nutrition-options.ts` non possa reintrodurlo
  senza far fallire `npm test`.
- In `app/api/logs/route.ts`: aggiungere un guardrail *soft* (non bloccante) quando
  `quantity_g > 2000` o le kcal calcolate per un singolo log superano 5000 — non
  impedisce il salvataggio (potrebbe essere corretto), ma la API restituisce un campo
  `warning` nel JSON di risposta che la UI di `AddFoodForm.tsx` mostra come alert, per
  intercettare errori di battitura (es. 1000g invece di 100g) prima che sporchino i
  target giornalieri.

**Criteri di accettazione**: inserendo una quantità anomala (es. 5000g di un alimento
qualsiasi) il log viene comunque salvato ma la UI mostra un avviso visibile prima o subito
dopo il salvataggio.

### A3. Nota su protezione dei dati (esplicitamente esclusa dal login)

Non introduciamo autenticazione utente in questa fase (vedi sezione 0). Restano però due
azioni di **configurazione**, non di codice applicativo, che non contraddicono la regola
"niente login" perché non riguardano l'utente finale dell'app:
- Verificare se il deploy Vercel è raggiungibile su un dominio pubblico e, se sì, valutare
  la **Vercel Deployment Protection** (password a livello di piattaforma, gestita da
  Vercel, non da IterUp) come barriera minima contro l'accesso casuale — attività di
  configurazione da fare tu su dashboard Vercel, nessun agente deve scriverci codice.
- Audit (sola lettura, nessuna modifica) che `ACTIVITY_WEBHOOK_SECRET` sia effettivamente
  impostato in produzione e che nessuna altra route accetti scritture senza un controllo
  equivalente al webhook.

### A4. PWA: coda di scrittura offline per il diario alimentare

**Problema**: `public/sw.js` fa solo cache-first di asset statici; ogni chiamata
`/api/**` richiede rete attiva. Il diario alimentare (l'azione più frequente dell'app) non
funziona con connessione assente o instabile — es. mensa/palestra con campo scarso.

**Lavoro**:
- `lib/offline-queue.ts`: piccola utility su IndexedDB (nessuna nuova libreria pesante)
  che accoda i payload di `POST /api/logs` falliti per assenza di rete.
- `app/diario/components/AddFoodForm.tsx`: salvataggio ottimistico — il log appare
  subito in UI anche offline, con un badge "in sincronizzazione" finché non è confermato
  dal server.
- `public/sw.js`: gestione del reinvio della coda al ritorno online. **Nota tecnica**:
  la Background Sync API ha supporto limitato/assente su iOS Safari, quindi il
  meccanismo primario deve essere un retry al `focus`/evento `online` del client
  (JavaScript nella pagina), non il solo service worker.
- Deduplica: ogni item in coda porta un id client-generato per evitare doppio invio se
  l'utente riapre l'app prima che la sync sia completata.

**Criteri di accettazione**: disattivando la rete, un log salvato nel diario appare
immediatamente in UI e viene effettivamente scritto su Supabase al ritorno della
connessione, senza duplicati e senza perdita.

### A5. Database alimenti: completamento e ricerca più tollerante

**Problema**: 179 alimenti contro l'obiettivo dichiarato di 200-300; nessuna
integrazione Open Food Facts visibile nel codice (solo prevista in fase di progettazione);
la ricerca full-text italiana (`tsvector`) non ha fallback per errori di battitura, e con
un catalogo di questa dimensione un typo può facilmente dare zero risultati.

**Lavoro**:
- `schema-migration-006-trgm.sql`: abilita l'estensione `pg_trgm` e un indice trigram su
  `foods.name`, usato come fallback quando la query full-text esistente
  (`idx_foods_name`) non trova risultati — non la sostituisce, la integra.
- `app/api/foods/search/route.ts`: se la ricerca full-text restituisce 0 righe, ritenta
  con similarity trigram prima di rispondere vuoto.
- Nuova route `app/api/foods/search-external/route.ts`: interroga Open Food Facts
  **solo su richiesta esplicita** dell'utente ("non trovato? cerca online"), non come
  fallback automatico — evita chiamate esterne non necessarie. I risultati importati in
  `foods` vanno marcati `source = 'off'` (coerente con la distinzione già esistente
  `usda`/`manual`).
- Data entry: portare il catalogo curato da 179 a 250-300 voci è lavoro di contenuto, non
  di codice — va pianificato come attività separata, non bloccante per il resto del PRD.

**Criteri di accettazione**: una ricerca con un errore di battitura comune (es. "pomodooro")
restituisce comunque risultati pertinenti; un alimento confezionato italiano non presente
nel catalogo è recuperabile via ricerca esterna e importabile con un tap.

### A6. Obiettivi collegati automaticamente ai dati reali

**Problema segnalato**: da verificare nel codice di `app/obiettivi/` e
`app/api/goals/*` se un obiettivo di tipo `activity` o `habit_streak` calcola da solo il
progresso leggendo rispettivamente `activity_logs`/`habit_logs`, o se richiede
aggiornamento manuale (comportamento oggi non confermato in modo esplicito).

**Lavoro**:
- Se il calcolo automatico manca: `GET /api/goals` deve arricchire ogni goal con un
  campo `current_value` calcolato a runtime dalla tabella pertinente (non salvato, per
  restare sempre coerente con i log reali), invece di affidarsi a un valore scritto a
  mano dall'utente.
- Nessuna modifica a `goals` nello schema: il calcolo resta lato API, `target_value` e
  `target_date` restano gli unici campi persistiti relativi al target.

**Criteri di accettazione**: creando un obiettivo "10.000 passi al giorno per 30 giorni"
e continuando a loggare passi normalmente (via webhook Shortcuts o form manuale), la
barra di avanzamento in dashboard/`app/obiettivi` si muove da sola, senza toccare il
goal.

---

## Parte B — Funzioni mancanti (dopo che la Parte A è completa)

### B1. Chat integratori con grounding (già specificata, mai implementata)

Riferimento: `PRD-addendum-onboarding-form.md` sezione 5.1 e memoria di progetto —
"la chat deve distinguere claim scientificamente studiati da anedottici" è un requisito
hard, non opzionale.

**Lavoro**:
- `schema-migration-007-supplement-chat.sql`: nuova tabella
  `supplement_chat_messages (id, user_id, role, content, citations jsonb, created_at)`.
  Non tocca la tabella `supplements` esistente.
- `app/api/supplements/chat/route.ts`: usa `callOpenRouter` (già esistente in
  `lib/openrouter.ts`) con `tools: [{"type": "openrouter:web_search"}]`; prompt di
  sistema che impone di etichettare ogni affermazione come **[Evidenza scientifica]** o
  **[Anedottico]** e di includere gli integratori già presenti nel profilo (tabella
  `supplements`) come contesto.
- `app/impostazioni/SupplementChat.tsx`: UI conversazionale, citazioni come link
  cliccabili (dal campo `citations` restituito da OpenRouter), cronologia persistita ma
  senza necessità di realtime.

**Criteri di accettazione**: una domanda su un integratore reale produce una risposta
che etichetta esplicitamente ogni claim, con almeno una citazione verificabile quando
disponibile; nessuna affermazione resta priva di etichetta scientifico/anedottico.

### B2. Export/backup dei dati

**Motivazione**: senza autenticazione né alcun sistema di recupero, un errore umano in
una migration SQL o un problema lato Supabase può far perdere mesi di storico senza rete
di sicurezza.

**Lavoro**:
- `app/api/export/route.ts`: `GET` restituisce un JSON completo di tutte le tabelle
  filtrate su `CURRENT_USER_ID` (profiles, user_targets, daily_logs, body_metrics,
  activity_logs, habits, habit_logs, goals, supplements). Sola lettura, nessun rischio
  sui contratti congelati.
- Bottone "Esporta i miei dati" in `app/impostazioni/`, scarica un file
  `iterup-backup-YYYY-MM-DD.json`.

**Criteri di accettazione**: il file scaricato contiene tutte le righe relative a
`CURRENT_USER_ID` per ciascuna tabella elencata, verificabile a occhio contro una query
diretta su Supabase.

### B3. Vista cronologica integrata (peso + kcal + attività + abitudini)

**Motivazione**: oggi ogni indicatore in dashboard è separato; manca un modo di vedere
correlazioni nel tempo (es. "nelle settimane in cui ho fatto più passi, il peso è sceso
più velocemente?").

**Lavoro**:
- `GET /api/dashboard/timeline?days=30`: aggrega in un'unica struttura dati peso
  (`body_metrics`), aderenza kcal (`daily_logs` vs `user_targets` attivo), streak
  abitudini (`habit_logs`) e minuti di attività (`activity_logs`) per data.
- `app/_dashboard/UnifiedTrendChart.tsx`: SVG scritto a mano, coerente con lo stile
  già usato in `TrendChart.tsx`/`CompositionTrendChart.tsx` — **nessuna nuova libreria
  di charting**, per restare fedele alla scelta architetturale esistente. Selettore
  7/30/90 giorni.

**Criteri di accettazione**: selezionando un intervallo, il grafico mostra le 4 serie
allineate per data, gestendo correttamente i giorni senza dato (gap visivo, non uno zero
implicito che falserebbe la lettura).

### B4. Promemoria giornaliero via iOS Shortcuts

**Motivazione**: nessuna notifica push nativa è prevista (richiederebbe infrastruttura
aggiuntiva, fuori scope per un'app a singolo utente); ma l'app si integra già con gli
Shortcuts iOS per l'ingestione attività, quindi lo stesso canale può coprire i
promemoria senza nuova infrastruttura.

**Lavoro**:
- `GET /api/reminders/status`: restituisce se il diario, il peso o le abitudini di oggi
  risultano vuoti, da interrogare da uno Shortcut iOS pianificato (automazione "ogni
  giorno alle 21:00").
- Lo Shortcut stesso (configurazione lato utente, non codice) mostra una notifica
  locale nativa iOS solo se l'endpoint segnala dati mancanti.

**Criteri di accettazione**: con diario vuoto dopo le 21:00, lo Shortcut mostra un
alert nativo; con almeno un log già presente, non mostra nulla.

---

## Sequenza consigliata

```
Parte A (in ordine, non parallelizzare A1→A2 rispetto al resto: sono la base di fiducia
per tutto quello che segue)
  1. A1 — Test sulle funzioni di calcolo
  2. A2 — Regressione bug macro + guardrail quantità anomale
  3. A3 — Solo audit/configurazione (nessuna dipendenza dal codice)
  4. A4 — Coda offline diario
  5. A5 — Database alimenti + ricerca tollerante
  6. A6 — Obiettivi collegati ai dati reali

Parte B (dopo che A1-A6 sono complete e npm run build + npm test passano)
  7. B2 — Export/backup (rapido, sola lettura, buon rapporto beneficio/sforzo — farlo
     presto anche se numerato dopo, protegge tutto il lavoro successivo)
  8. B3 — Vista cronologica integrata
  9. B1 — Chat integratori con grounding (il più corposo, nuova tabella + AI)
  10. B4 — Promemoria via Shortcuts (il più leggero, ultimo perché dipende solo da
      endpoint di lettura già stabili)
```

## Definition of Done

- [ ] `npm test` verde su tdee/composition/body-indices/nutrition-options
- [ ] Test di regressione sul bug storico delle proteine presente e verde
- [ ] Guardrail su quantità anomale attivo in `/api/logs`
- [ ] Coda offline: un log salvato senza rete arriva su Supabase al ritorno online, senza duplicati
- [ ] Ricerca alimenti tollerante ai typo + import da Open Food Facts su richiesta
- [ ] Obiettivi di tipo activity/habit_streak avanzano automaticamente dai log reali
- [ ] Export dati funzionante e verificato
- [ ] Grafico cronologico integrato (peso/kcal/attività/abitudini) su 7/30/90 giorni
- [ ] Chat integratori con etichettatura scientifico/anedottico e citazioni cliccabili
- [ ] Endpoint stato promemoria integrato in uno Shortcut iOS funzionante
- [ ] `npm run build` passa dopo ogni fase, prima di considerarla completa
- [ ] Nessun contratto congelato modificato senza segnalazione esplicita
- [ ] Nessuna schermata di login introdotta (fuori scope, per scelta)
