# Addendum PRD — IterUp: Coach Comportamentale

Questo documento integra `iterup_PRD_multiagente.md` e va letto insieme a `CLAUDE.md`
(regole non negoziabili, contratti congelati) e a
`PRD-addendum-hardening-completamento.md`, che deve essere completo prima di iniziare
questo lavoro: il coach commenta dati che devono già essere affidabili (test sulle
formule, guardrail su input anomali) prima di poterli usare per generare messaggi.

## 1. Cosa NON è questo modulo

Va detto in apertura perché guida ogni scelta tecnica successiva: questo non è un
sistema che "impara la psicologia" dell'utente in senso forte — con i volumi di dati di
un solo utente non c'è segnale sufficiente per un modello che apprende pattern
individuali complessi. È un **motore di nudge comportamentali**: regole esplicite che
rilevano pattern nei dati + un layer LLM che scrive il messaggio nel tono giusto + un
ciclo di feedback semplice (non machine learning) che aggiusta frequenza e tono nel
tempo. Meno "magico", ma è ciò che si può costruire e mantenere realmente, ed è comunque
più utile di un coach generico.

## 2. Principio di progettazione trasversale

Ogni messaggio generato deve rispettare, sempre, questi vincoli — validi per nudge,
rituale mattutino e rituale serale:

- Mai linguaggio di colpa o vergogna legato a cibo, peso o mancata performance
  ("hai sgarrato", "disciplina", "dovresti vergognarti").
- Mai trattare un singolo dato come giudizio definitivo (un pasto, un giorno, una
  misurazione) — il rumore statistico va sempre riconosciuto esplicitamente quando
  rilevante.
- Mai "toxic positivity" generica ("ce la puoi fare!" senza contenuto) — un messaggio
  deve sempre contenere o un dato reinquadrato o un'azione concreta, mai le due cose
  vuote insieme.
- Il coach non è uno strumento clinico: non interpreta, non etichetta, non fa diagnosi
  su ciò che l'utente scrive nel diario testuale (vedi 4.3). Il suo perimetro è il
  supporto all'aderenza agli obiettivi che l'utente ha scelto, non il supporto
  psicologico in senso clinico.

---

## 3. Motore di trigger (nudge in tempo reale)

Ogni scrittura esistente (`POST /api/logs`, `POST /api/body-metrics`,
`POST /api/habits/log`, valutazione periodica su `goals`) è il punto in cui valutare se
un pattern merita un commento. Nessuna infrastruttura nuova: la valutazione gira dentro
la stessa richiesta, subito dopo la scrittura del dato.

| Trigger | Cosa rileva | Principio comportamentale | Tono |
|---|---|---|---|
| Peso sceso ma poco / stabile | confronto con trend delle ultime 2-3 settimane (`body_metrics`), non col solo ultimo valore | Rinforzo sul processo, non sul risultato (self-efficacy, Bandura): il peso è un output rumoroso, l'aderenza è l'unica cosa controllabile | dato + reinquadramento |
| Pattern orario di fame | clustering statistico degli orari di log/spuntino sulle ultime settimane (`daily_logs.created_at`) | Antecedent design (CBT): un pattern orario ricorrente si affronta progettando l'ambiente (spuntino pianificato), non con forza di volontà | suggerimento pratico |
| Abitudine saltata | assenza di `habit_logs` per un'abitudine attiva nel giorno | "Never miss twice": un salto isolato non deve rompere psicologicamente lo streak se reinquadrato subito | solo al PRIMO salto, mai ripetuto |
| Goal rimandato | `target_date` in avvicinamento con progresso insufficiente rispetto al ritmo necessario | Implementation intentions (Gollwitzer): aiuta a ridefinire un prossimo passo concreto (quando/dove/come), non a "motivare" in astratto | orientato all'azione |
| Pasto sopra target | kcal giornaliere che superano il target di una soglia (es. >15%) dopo un log | Separazione comportamento/identità: un pasto è un dato in una media settimanale, non un fallimento | il più delicato — vedi guardrail 3.1 |
| Streak raggiunta | soglie (7/30/90 giorni) su `habit_logs` | Milestone reinforcement, con parsimonia | breve, concreto |

### 3.1 Guardrail sul motore di trigger

- **Cap di frequenza per categoria**: es. max 1 messaggio "pasto sopra target" al
  giorno, max 1 messaggio "peso" a settimana anche loggando ogni giorno.
- **Nessun trigger "pasto sopra target" nelle prime settimane di utilizzo**, finché non
  esiste una baseline storica sufficiente — un dato isolato senza contesto storico
  genera più ansia che insight.
- **Switch on/off per categoria**, immediato e visibile, non nascosto in sottomenu.

### 3.2 Generazione del messaggio

Riusa `lib/openrouter.ts` così com'è (stesso meccanismo di `suggest-meal`), chiamata in
`jsonMode` con schema `{ message, category, tone_used }`. Contesto passato al prompt:
trigger + dati grezzi rilevanti + tono preferito appreso (vedi 3.3) +, quando pertinente,
il testo letterale di `goals.title` scritto dall'utente — il "ricordare il proprio
obiettivo" cita quello che l'utente ha scritto, non una frase preconfezionata.

### 3.3 Ciclo di feedback (non ML)

Stesso pattern già esistente per `meal_suggestion_feedback`:
- Ogni messaggio ha un 👍/👎 rapido + "silenzia questo tipo di messaggio".
- Tasso di gradimento aggregato per `trigger_type`: sotto una soglia, la frequenza di
  quel tipo si riduce automaticamente prima di essere disattivata.
- Tono (2-3 varianti: diretto/pratico vs. riflessivo) salvato per utente, aggiustato in
  base a quale riceve più 👍 — con un solo utente non ha senso differenziare oltre
  questo.

---

## 4. Rituale del mattino — `GET /api/coach/morning`

Pensato per essere chiamato da uno Shortcut iOS pianificato (automazione "ogni giorno
alle [ora scelta dall'utente]"), che legge la risposta e la fa parlare via Siri o la
mostra come notifica locale. Nessuna infrastruttura push nuova.

Tre componenti nella risposta:

1. **Riflessione motivante originale** — generata da `callOpenRouter`, MAI un aneddoto
   storico con dettagli o citazioni attribuite a persone reali (un LLM inventa dettagli
   plausibili ma falsi con facilità: rischio di accuratezza e di attribuzione errata).
   Il prompt genera una breve riflessione originale ancorata a un principio
   comportamentale specifico (piccoli passi, consistenza, auto-efficacia) — vedi
   prompt di sistema in appendice.
2. **Le 3 priorità della giornata** — lette da `daily_focus` (tabella nuova, vedi 6) se
   l'utente le ha inserite (form rapido, la sera prima o al risveglio); se il campo è
   vuoto, l'endpoint le deduce da `goals` più urgenti e da `habits` non ancora completate
   oggi.
3. **Un'abitudine da ricordare** — una sola, scelta con priorità: (a) quella con lo
   streak più a rischio, altrimenti (b) quella che il pattern orario (3, trigger
   "pattern di fame"/orari di log) indica più a rischio di essere saltata oggi.

**Criteri di accettazione**: chiamando l'endpoint la mattina, la risposta contiene
sempre i 3 elementi anche se `daily_focus` è vuoto (fallback automatico su goals/habits);
il testo generato non contiene mai citazioni attribuite a persone reali o eventi storici
con dettagli verificabili.

---

## 5. Rituale della sera — `GET /api/coach/evening`

Stesso meccanismo di consegna (Shortcut iOS pianificato a un orario scelto).

L'endpoint raccoglie:
- riepilogo macro/kcal del giorno (`GET /api/logs/summary`, già esistente)
- peso/misure se registrati oggi (`body_metrics`)
- abitudini completate/saltate (`habit_logs`)
- attività fisica del giorno (`activity_logs`)
- avanzamento sui goal in corso
- testo del diario personale, se scritto (`journal_entries`, tabella nuova, vedi 6 —
  distinta dal "diario alimentare" per evitare confusione di nome, la chiameremo "Note
  del giorno" in UI)

...e genera un messaggio di chiusura. Vincoli di tono specifici (oltre a quelli
trasversali in sezione 2):
- **Consolidamento, non energia**: chiusura calma, mai "hype" — un discorso motivazionale
  sera troppo energico rischia di interferire con l'addormentamento.
- **Nessuna lista di cose da migliorare**: la sera si riconosce quello che è successo,
  senza checklist di correzioni.
- **Se il diario testuale contiene segnali di disagio reale** (non solo "giornata no"),
  il messaggio non deve provare a interpretare, minimizzare o fare da terapeuta — si
  limita a un tono più sobrio quella sera, senza etichettare ciò che l'utente ha scritto
  (vedi vincolo di sezione 2 sul perimetro non clinico del coach).

**Criteri di accettazione**: il messaggio serale cambia in modo percepibile in base a
cosa è successo nella giornata (non è un template fisso con variabili inserite); non
contiene mai una lista puntata di correzioni; se il diario è vuoto, l'endpoint funziona
comunque usando solo i dati strutturati.

---

## 6. Schema — nuove tabelle

Coerenti con le convenzioni esistenti (una riga al giorno dove pertinente, filtrate su
`CURRENT_USER_ID`), in `schema-migration-008-coach.sql`:

```sql
create table if not exists public.coach_nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  trigger_type text not null,
  trigger_data jsonb not null default '{}',
  message text not null,
  tone_used text,
  shown_at timestamptz default now(),
  reaction text check (reaction in ('like', 'dislike', 'dismissed')),
  created_at timestamptz default now()
);

create table if not exists public.coach_preferences (
  user_id uuid references auth.users(id) on delete cascade not null,
  trigger_type text not null,
  enabled boolean default true,
  preferred_tone text,
  satisfaction_score numeric,
  last_shown_at timestamptz,
  primary key (user_id, trigger_type)
);

create table if not exists public.daily_focus (
  user_id uuid references auth.users(id) on delete cascade not null,
  focus_date date not null default current_date,
  priority_1 text,
  priority_2 text,
  priority_3 text,
  created_at timestamptz default now(),
  primary key (user_id, focus_date)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_date date not null default current_date,
  content text not null,
  created_at timestamptz default now(),
  unique (user_id, entry_date)
);
```

Nessuna modifica ai contratti congelati esistenti (`schema.sql` resta invariato, questa è
una migration additiva).

---

## 7. Sequenza consigliata

```
1. Schema — migration 008 (tabelle sopra)
2. Motore di trigger sui 6 pattern (sezione 3) + ciclo di feedback 👍/👎
3. Rituale mattutino (dipende da: daily_focus, goals, habits — già presenti dopo il
   passo 1)
4. Rituale serale (dipende da: journal_entries + tutte le fonti già lette da altri
   moduli — nessuna nuova dipendenza dati oltre a journal_entries)
5. UI: card "Il tuo coach oggi" in dashboard, form "Note del giorno", form priorità
   giornaliere, switch on/off per categoria trigger in Impostazioni
6. Configurazione Shortcuts iOS (lato utente, non codice) per mattina/sera
```

## 8. Definition of Done

- [ ] Ogni trigger della tabella in sezione 3 implementato con il proprio cap di
      frequenza
- [ ] Ciclo 👍/👎 funzionante, con riduzione automatica di frequenza sotto soglia di
      gradimento
- [ ] `/api/coach/morning` risponde sempre con 3 componenti, anche a `daily_focus` vuoto
- [ ] `/api/coach/evening` cambia contenuto in base ai dati reali del giorno, mai lista
      di correzioni
- [ ] Nessun messaggio generato contiene citazioni attribuite a persone reali
- [ ] Switch on/off per categoria visibile e immediato in UI
- [ ] Nessuna modifica a `schema.sql` esistente, solo migration additiva
- [ ] `npm run build` passa
