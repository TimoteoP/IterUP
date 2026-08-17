# Addendum PRD — IterUp: Bussola di Ricomposizione Corporea

Questo documento integra il PRD principale di IterUp e descrive una nuova feature: la **Bussola di Ricomposizione**, una lettura direzionale (non solo il peso) di dove sta andando la composizione corporea dell'utente, incrociata con il bilancio energetico reale del periodo. Claude Code deve trattare i vincoli sotto come architetturali, non come suggerimenti opzionali. Le formule alla sezione 4 vanno implementate esattamente come scritte, non approssimate o "migliorate" senza conferma esplicita.

## 1. Scopo e contesto

Il tracking del peso da solo è fuorviante nei periodi di ricomposizione corporea (perdita di grasso + guadagno/mantenimento di massa magra simultanei): il peso può restare stabile mentre il progresso reale è alto. Questa feature scompone ogni check-in in massa grassa (FM) e massa magra (FFM), la incrocia con il bilancio calorico del periodo, e restituisce una **direzione leggibile** invece di un solo numero.

**Riferimento implementativo:** è stato consegnato in chat un prototipo funzionante standalone (`bussola-ricomposizione.html`, HTML/JS con Chart.js via CDN, nessun framework) che contiene già la logica di calcolo completa e validata insieme all'utente, oltre al design visivo dell'ago/quadrante. Claude Code deve leggerlo come **spec eseguibile della logica di calcolo**, non solo come mockup — porta quella logica dentro l'architettura Next.js/Supabase di IterUp, non la reinventa da zero. Il design visivo (palette ink/brass, font Fraunces/Inter/JetBrains Mono) va adattato al design system già esistente in IterUp se ne esiste uno; se non esiste ancora un design system consolidato, può essere preso come riferimento di partenza.

## 2. Vincoli architetturali

- **Riusa il profilo utente esistente** (età, sesso, altezza, livello di attività) dalla tabella/schema di onboarding già presente in IterUp. Non duplicare questi campi in una nuova tabella — verificare lo schema attuale prima di procedere.
- **Nuova tabella `body_measurements`** in Supabase (o estensione della tabella misure esistente, se già presente dal PRD onboarding — verificare prima di crearne una nuova).
- Tutti i calcoli (BF% Navy, Mifflin-St Jeor, bilancio energetico, IR, punteggi bussola) vanno implementati come **funzioni pure**, in un modulo condiviso (es. `lib/composition.ts`), separate dai componenti React e testabili in isolamento con unit test. Non inline nei componenti.
- Nessuna chiamata a modelli LLM/OpenRouter è richiesta per questa feature: è calcolo deterministico locale.

## 3. Data model

Tabella `body_measurements`:

| campo | tipo | note |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK utente |
| date | date | data del check-in |
| weight_kg | numeric | obbligatorio |
| neck_cm | numeric | obbligatorio |
| waist_cm | numeric | obbligatorio |
| hip_cm | numeric, nullable | **obbligatorio se profilo.sex = 'F'**, altrimenti null |
| kcal_period | numeric, nullable | kcal totali ingerite dal check-in precedente a questo; nullable se l'utente non le ha loggate |
| neck_feel | smallint | enum: -1 (più pieno), 0 (uguale), 1 (più sottile/vestiti più larghi) |
| wrist_feel | smallint | enum: -1 (più stretto del solito), 0 (uguale), 1 (orologio non si chiude più/più sottile) |
| created_at | timestamptz | default now() |

Validazione lato form (bloccante, non solo warning):
- weight_kg, neck_cm, waist_cm sempre richiesti
- hip_cm richiesto se e solo se sesso donna
- se manca uno di questi, il salvataggio è bloccato con messaggio esplicito (replica esatta della logica del prototipo, funzione `saveEntry`)

## 4. Formule (da portare 1:1)

**BF% — formula Navy (Hodgdon & Beckett, 1984), cm:**

```
Uomo:  BF% = 495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450
Donna: BF% = 495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450
```

**FM / FFM:**
```
FM  = weight × BF% / 100
FFM = weight − FM
```

**TDEE — Mifflin-St Jeor + fattore attività:**
```
Uomo:  BMR = 10·weight + 6.25·height − 5·age + 5
Donna: BMR = 10·weight + 6.25·height − 5·age − 161
TDEE = BMR × activity_factor
```
Fattori attività: sedentario 1.2 · leggero 1.375 · moderato 1.55 · alto 1.725 · molto alto 1.9.

**Bilancio energetico del periodo (solo se `kcal_period` presente sull'ultimo check-in):**
```
days = giorni trascorsi tra check-in precedente e attuale (min 1)
maintenance_period = TDEE × days
balance = kcal_period − maintenance_period
expected_delta_weight_kg = balance / 7700
```
Nota da mantenere visibile in UI (non rimuovere): 7700 kcal/kg è un'approssimazione statica (Wishnofsky, 1958); non è una previsione precisa, va presentata solo come riferimento direzionale.

**Indice di Ricomposizione (IR), tra due check-in consecutivi:**
```
IR_raw = (FFM_attuale − FFM_precedente) − (FM_attuale − FM_precedente)
qual_nudge = (neck_feel × 0.15) + (wrist_feel × 0.10)
comp_score_raw = IR_raw + qual_nudge
comp_score = clamp(comp_score_raw / 1.5, -1, 1)
```

**Asse energetico normalizzato:**
```
se balance disponibile: energy_score = clamp(balance / (|maintenance_period| × 0.15), -1, 1)
altrimenti:              energy_score = clamp((weight_attuale − weight_precedente) / 1.5, -1, 1)
```

## 5. Logica di direzione (5 zone)

Applicare in quest'ordine (replica esatta della funzione `render()` del prototipo):

1. `|comp_score_raw| ≤ 0.05` E balance noto E `|balance| < maintenance_period × 0.05` → **Mantenimento stabile**
2. deficit (balance < 0, o peso in calo se balance ignoto) E `comp_score_raw > 0.05` → **Ricomposizione ideale**
3. surplus E `comp_score_raw > 0.05` → **Bulk pulito**
4. surplus E `comp_score_raw < -0.05` → **Accumulo di grasso**
5. deficit E `comp_score_raw < -0.05` → **Perdita muscolare** (mostrare come warning/colore d'allerta, non neutro)
6. altrimenti → **Direzione ambigua** (serve un altro check-in)

Ogni zona ha un'etichetta breve + una frase esplicativa (testi presenti nel prototipo, riusabili come stringhe i18n-ready).

## 6. UI/UX

- Vive come nuova sezione (es. `/progressi/composizione` o tab dedicata) — **non sostituisce** la vista peso esistente, la affianca.
- **Richiede minimo 2 check-in** per attivarsi. Prima di allora: stato vuoto esplicito ("registra il primo check-in per stabilire il punto di partenza"), niente bussola disegnata a metà con dati finti.
- Componente ago/bussola: SVG leggero (non canvas), replica del disegno nel prototipo (`drawCompass`) — cerchio, assi Nord/Sud (massa magra su/giù) ed Est/Ovest (deficit/surplus), ago con punta.
- **Breakdown numerico sempre visibile e non collassabile sotto la bussola** (bilancio kcal periodo, Δpeso atteso, Δpeso reale, IR, correzione soggettiva) — requisito di trasparenza esplicito, non un dettaglio opzionale da nascondere in un tooltip.
- Grafico trend FM/FFM/peso nel tempo: se IterUp ha già una libreria grafici in uso altrove nell'app, riusare quella per coerenza; altrimenti Chart.js o Recharts, a scelta di Claude Code.
- Form check-in: includere i due select qualitativi (colletto/collo, orologio/polso) con le stesse 3 opzioni del prototipo.

## 7. Edge case

- Primo check-in in assoluto → salva baseline, nessuna bussola, nessun errore.
- `kcal_period` non inserito sull'ultimo check-in → bilancio energetico mostrato come "n.d.", direzione calcolata solo sull'asse composizione con nota esplicita in UI che manca il dato energetico.
- Intervallo tra check-in molto breve (< 3 giorni) → mostrare un avviso soft che il segnale è rumoroso su intervalli brevi (fluttuazioni idriche), senza bloccare il calcolo.
- Cambio di sesso nel profilo tra un check-in e l'altro → ricalcolare storicamente con il sesso dichiarato nel profilo al momento del check-in, non quello attuale (evita di rompere lo storico se l'utente corregge un dato).

## 8. Fuori scope (esplicitamente, per evitare scope creep)

- Nessuna raccomandazione automatica di dieta o allenamento generata dalla direzione. La bussola descrive, non prescrive.
- Nessuna notifica push basata sulla direzione in questa iterazione.
- Nessun calcolo di %BF con petto/coscia/polso dentro alla formula — quelle misure (se già raccolte altrove in IterUp) restano indicatori di contesto separati, non entrano nel calcolo di BF%/IR.

## 9. Domande aperte prima di iniziare l'implementazione

Claude Code deve porre queste domande a Timoteo prima di scrivere codice, non assumerle:

1. La tabella misure/body metrics esiste già nello schema (dal PRD onboarding)? Se sì, estenderla invece di crearne una nuova.
2. Dove deve vivere questa sezione nella IA dell'app — nuova tab di primo livello o sotto una pagina "Progressi" già esistente?
3. C'è già una libreria grafici in uso altrove in IterUp da riusare per coerenza?
