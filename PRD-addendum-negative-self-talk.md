# PRD Addendum — Modulo Negative Self-Talk & Cognitive Reframing

**Stato**: Draft per implementazione (Claude Code)
**Dipendenze**: nessuna hard dependency dai moduli esistenti, ma condivide pattern architetturali con `PRD-addendum-coach-comportamentale.md` (guardrail, tono) e può opzionalmente collegarsi a `journal_entries` in fase 2 (vedi "Fuori scope").
**Principio cardine (non negoziabile)**: onestà chirurgica sul *pattern cognitivo*, mai giudizio sulla *persona*. Ogni testo generato — reframe, feedback, flag — va validato contro questo criterio prima di essere mostrato. Vedi sezione Guardrail per i dettagli operativi.

---

## 1. Razionale scientifico (per riferimento, non da esporre in UI se non nei tooltip)

- **Cognitive restructuring (CBT — Beck, Burns)**: identificazione del pensiero automatico → categorizzazione per distorsione → raccolta di evidenze a favore/contro → riformulazione. Base dell'intero flusso "guided".
- **Self-compassion (Neff)**: motiva il vincolo del tono (sezione Guardrail). L'autocritica dura aumenta la ruminazione, non la riduce — è la ragione per cui "brutale" si applica al dato, non alla persona.
- **Cognitive defusion (ACT — Hayes)**: giustifica l'opzione di "sola registrazione senza combattere il pensiero" per i casi in cui il reframe attivo rischia di alimentare il rimuginio (vedi step 4 del flusso guidato).
- **Consider-the-opposite (Larrick et al., debiasing literature)**: contromisura strutturata al confirmation bias, integrata come step obbligatorio in ogni thought record (non modulo separato, come da tua indicazione).
- **Expressive writing (Pennebaker)**: motiva perché la cattura testuale libera (non solo tag) ha valore anche a prescindere dal reframe.

---

## 2. Tassonomia delle distorsioni cognitive (fissa — Burns, 10 categorie)

Enum fisso, usato sia per tagging utente che per classificazione LLM. Non estendibile senza revisione esplicita (evita drift semantico nel tempo che romperebbe la dashboard analitica).

```
ALL_OR_NOTHING        -- pensiero tutto-o-niente
OVERGENERALIZATION     -- generalizzazione da un singolo evento
MENTAL_FILTER          -- filtro mentale (solo il negativo è visibile)
DISCOUNTING_POSITIVE   -- svalutazione del positivo
JUMPING_TO_CONCLUSIONS -- include mind-reading e fortune-telling come sub-tag
MAGNIFICATION          -- catastrofizzazione o minimizzazione (bidirezionale)
EMOTIONAL_REASONING    -- "mi sento così quindi è vero"
SHOULD_STATEMENTS      -- imperativi rigidi verso sé/altri
LABELING               -- etichettamento globale ("sono un fallito" vs "ho fallito questo")
PERSONALIZATION        -- attribuzione di colpa/causalità eccessiva a sé
```

Ogni tag ha `source: 'user' | 'llm'` — permette in dashboard di misurare quanto l'auto-percezione dell'utente diverge da quella del modello nel tempo (metrica interessante per il tracciamento a 2-3 mesi che citavi).

---

## 3. Schema dati (tabelle dedicate, migration separata come da CLAUDE.md)

```sql
-- Cattura rapida: l'unico step obbligatorio, deve essere fattibile in <15 secondi da mobile
CREATE TABLE self_talk_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  mood_before SMALLINT CHECK (mood_before BETWEEN 1 AND 10),
  theme TEXT,                          -- auto-tag LLM: 'lavoro' | 'corpo' | 'relazioni' | 'economico' | 'altro'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guided_session_started BOOLEAN NOT NULL DEFAULT false,
  guided_session_completed BOOLEAN NOT NULL DEFAULT false
);

-- Distorsioni identificate (molti-a-uno con entry, sia utente che LLM possono taggare la stessa entry)
CREATE TABLE distortion_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES self_talk_entries(id) ON DELETE CASCADE,
  distortion_type TEXT NOT NULL CHECK (distortion_type IN (
    'ALL_OR_NOTHING','OVERGENERALIZATION','MENTAL_FILTER','DISCOUNTING_POSITIVE',
    'JUMPING_TO_CONCLUSIONS','MAGNIFICATION','EMOTIONAL_REASONING',
    'SHOULD_STATEMENTS','LABELING','PERSONALIZATION'
  )),
  source TEXT NOT NULL CHECK (source IN ('user','llm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Il thought record guidato vero e proprio (1:1 con entry, nullable finché non completato)
CREATE TABLE reframe_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL UNIQUE REFERENCES self_talk_entries(id) ON DELETE CASCADE,
  evidence_for TEXT,                   -- prove a favore del pensiero
  evidence_against TEXT,               -- prove contro
  consider_opposite TEXT NOT NULL,     -- step obbligatorio, non nullable: "cosa ignoreresti se cercassi solo conferme?"
  reframe_text TEXT,
  mood_after SMALLINT CHECK (mood_after BETWEEN 1 AND 10),
  llm_transcript JSONB,                -- turni della sessione socratica, per audit/debug, mai mostrato in UI normale
  completed_at TIMESTAMPTZ
);

-- Flag di pattern ricorrente/severo, generati da job periodico, mai in tempo reale sulla singola entry
CREATE TABLE pattern_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_type TEXT NOT NULL CHECK (flag_type IN ('frequency_high','intensity_high','theme_concentration','crisis_language')),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  summary_text TEXT NOT NULL,           -- il testo "dati grezzi" mostrato all'utente, generato da regole non da LLM libero (vedi sez. 6)
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. Flusso utente

**Step 1 — Quick capture (mobile-first, <15s)**
Apri l'app → campo di testo libero + slider mood_before opzionale → salva. Nessun altro step obbligatorio qui: se l'utente chiude l'app dopo questo, l'entry è comunque utile per la dashboard.

**Step 2 — Offerta di sessione guidata**
Subito dopo il salvataggio, prompt non invasivo: *"Vuoi lavorarci sopra ora (2 min) o solo registrarlo?"* — rispetta il principio ACT di non forzare sempre l'engagement attivo (a volte la sola registrazione/defusion è la scelta giusta, e forzare il reframe rischia di alimentare il rimuginio).

**Step 3 — Sessione socratica (se accettata)**
L'LLM (via OpenRouter, stesso fallback chain già definito nell'addendum OpenRouter) guida con domande in stile CBT:
1. Identifica la distorsione (mostra 1-2 tag più probabili dalla tassonomia fissa, l'utente conferma o corregge)
2. Chiede evidenza a favore
3. Chiede evidenza contro
4. **Chiede esplicitamente "consider the opposite"**: *"Se stessi cercando solo conferme a questo pensiero, cosa staresti ignorando?"* — step non saltabile
5. Propone (non impone) un reframe, l'utente lo modifica liberamente
6. Chiede mood_after

**Step 4 — Salvataggio**
`reframe_sessions` popolata, `guided_session_completed = true`.

**Step 5 — Rilevamento pattern (background, non in tempo reale)**
Job schedulato (settimanale) analizza `self_talk_entries` + `distortion_tags` delle ultime 4 settimane e genera `pattern_flags` secondo regole esplicite (sezione 6) — non lascia all'LLM la decisione di "quanto è grave", per evitare over-alarming o minimizzazione dovuta a variabilità del prompt.

---

## 5. Integrazione nella quotidianità

Come da tua indicazione (punto 8), il modulo entra nel rituale già esistente:
- **Rituale serale**: se ci sono entry non ancora lavorate della giornata, un prompt gentile le richiama prima della chiusura serale (non un obbligo, un invito).
- **Home screen**: shortcut permanente per la quick capture, sempre a un tap di distanza — è il requisito UX più critico, perché la cattura nel momento è ciò che rende i dati reali invece che ricostruiti a posteriori.

---

## 6. Regole per `pattern_flags` (esplicite, non delegate all'LLM)

```
frequency_high:      >= 8 entries nella finestra di 7 giorni con lo stesso theme
intensity_high:      media mood_before <= 3 su >= 5 entries nella finestra di 14 giorni
theme_concentration: >= 60% delle entries in 30 giorni concentrate su un singolo theme
crisis_language:     [VINCOLO DI SICUREZZA — vedi sotto]
```

**`crisis_language` non è una feature di prodotto normale.** Se il testo grezzo (raw_text) contiene indicatori di ideazione di autolesionismo o disperazione acuta, il flusso NON deve procedere con reframe/analisi normale. Deve interrompere il flusso guidato e mostrare un messaggio fisso, pre-scritto, non generato dinamicamente dall'LLM, con risorse di supporto (es. numero di emergenza/crisi locale). Questo è un vincolo di sicurezza assoluto, non negoziabile in fase di implementazione — va discusso con te il testo esatto del messaggio e le risorse italiane da includere prima del rilascio, non lasciato a discrezione del modello in produzione.

---

## 7. Dashboard analitica

- Distribuzione distorsioni (frequenza per tipo, ultimi 30/90 giorni)
- Trend mood_before → mood_after (misura se il reframe funziona davvero o è rituale vuoto)
- Concentrazione per theme e per giorno/fascia oraria
- Divergenza tag `source: user` vs `source: llm` nel tempo (indicatore indiretto di crescita della consapevolezza metacognitiva)
- Storico `pattern_flags` con stato acknowledged

---

## 8. Guardrail (estensione di quelli del coach comportamentale)

1. **Onestà sul pattern, mai sulla persona** (vincolo cardine, sezione iniziale).
2. Nessuna diagnosi clinica in nessun testo generato. `pattern_flags` descrive frequenza/intensità osservata, mai un'etichetta ("questo è un disturbo X").
3. Nessun testo generato dinamicamente per `crisis_language` — solo messaggio fisso pre-approvato.
4. Il reframe proposto dall'LLM è sempre editabile e mai imposto come "la verità corretta" — coerente con l'evidenza che il reframe efficace deve essere creduto dall'utente, non solo somministrato.
5. Nessuna lista enumerata di "errori" nella stessa sessione (stesso vincolo del coach serale) — un pensiero, una distorsione alla volta.

---

## 9. Fuori scope (fase 1)

- Integrazione diretta con `journal_entries` del modulo coach (possibile in fase 2, ma tenuta separata ora per evitare accoppiamento prematuro tra moduli con scopi diversi)
- Notifiche push proattive basate su pattern (rischio di over-engineering prima di avere dati reali su cui calibrare le soglie)
- Editing/cancellazione retroattiva delle distorsioni taggate da LLM in sessioni passate (mantiene l'integrità storica per la dashboard)

---

## 10. Domande aperte per Claude Code (da chiarire con Timoteo prima di iniziare)

1. Testo esatto e risorse per il messaggio fisso `crisis_language` (numero verde italiano da includere — va verificato quale sia attualmente corretto e attivo).
2. Soglie numeriche di `frequency_high`/`intensity_high`/`theme_concentration` sono ragionevoli come default o Timoteo preferisce partire più conservativo (meno flag) nei primi 2-3 mesi finché non c'è baseline?
3. Il tag `theme` è enum fisso o should evolvere in modo semi-libero (LLM propone nuovi theme oltre ai 5 default se ricorrenti)?
