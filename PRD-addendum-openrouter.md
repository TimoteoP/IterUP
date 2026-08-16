# Addendum PRD — IterUp: Motore AI per proposte pasto (OpenRouter)

Questo documento integra il PRD principale di IterUp e definisce come deve essere implementata l'integrazione con OpenRouter per la generazione delle 5 proposte pasto. Claude Code deve seguire queste indicazioni come vincolo architetturale, non come suggerimento opzionale.

## 1. Scelta del gateway

Si usa **OpenRouter** (`https://openrouter.ai/api/v1`, API compatibile OpenAI) come gateway verso gli LLM per la generazione delle proposte pasto. Non usare API dirette dei singoli provider (OpenAI, Google, ecc.) in questa fase: OpenRouter permette di cambiare modello senza modificare il codice, e per il volume di richieste previsto (utente singolo, poche chiamate al giorno) la fee del 5,5% sui crediti è trascurabile.

## 2. Selezione del modello: NIENTE Auto Router

**Vincolo esplicito: non usare `"model": "openrouter/auto"`.**

Motivazione: l'Auto Router di OpenRouter seleziona il modello in base alla spesa aggregata della community nell'ultima settimana. Per un task che richiede output strutturato e ripetibile (JSON con macro coerenti), questo introduce:
- imprevedibilità nel formato/qualità della risposta, perché il modello effettivo cambia nel tempo senza controllo esplicito
- impossibilità di ottimizzare il prompt per un modello specifico, dato che non sai a priori chi risponderà

Invece:
- Il modello (o i modelli) va **specificato esplicitamente** nel campo `model` (o `models` per il fallback, vedi punto 3) della richiesta.
- La scelta del modello è una decisione di prodotto che faccio io dopo test manuali sul playground OpenRouter, non un parametro da lasciare all'automazione del gateway.

## 3. Fallback tra modelli (non tra provider generici)

Usare il parametro **`models`** (array, non singolo `model`) per definire un ordine di fallback esplicito tra i modelli scelti a monte (vedi punto 6 per la lista definitiva, attualmente 3 livelli):

```json
{
  "models": ["<modello-primario>", "<modello-fallback-1>", "<modello-fallback-2>"],
  ...
}
```

Se il modello primario è in rate-limit o down, OpenRouter prova automaticamente il secondo. Questo NON è routing "intelligente" stile Auto Router: sono io a decidere quali due modelli mettere in lista, Claude Code deve solo implementare il meccanismo di fallback e loggare quale modello ha effettivamente risposto (campo `model` nella response) per ogni chiamata, così da poter fare debugging/monitoraggio qualità nel tempo.

## 4. Ottimizzazione costo tra provider dello STESSO modello

È accettabile (e da implementare) l'uso di:

```json
{
  "provider": { "sort": "price" }
}
```

Questo instrada tra i diversi provider che servono *lo stesso modello scelto* verso quello più economico, senza cambiare il modello stesso. È una automazione sicura perché non tocca la qualità/formato della risposta, solo il costo infrastrutturale a parità di modello.

## 5. Requisiti tecnici della chiamata

- Output atteso: JSON strutturato con lo schema delle 5 proposte pasto (schema esatto da definire in una sezione successiva del PRD/con me prima dell'implementazione — non inventare campi).
- Il modello scelto deve supportare in modo affidabile risposte JSON valide (verificare supporto a JSON mode / structured output nella scheda del modello su OpenRouter prima di adottarlo).
- Ogni chiamata deve salvare in log: modello richiesto, modello effettivamente usato (per capire se è scattato il fallback), costo stimato della chiamata, esito (successo/errore/parsing fallito).
- Gestire esplicitamente il caso di parsing JSON fallito con retry (max 1-2 tentativi) prima di mostrare errore all'utente.

## 6. Modelli scelti (definitivo)

Catena di fallback a 3 livelli, in ordine:

1. **`deepseek/deepseek-v4-flash:free`** — versione gratuita del modello primario. Nessun costo, stessa qualità del fratello a pagamento. Ha rate limit e priorità di coda più bassa (comportamento tipico dei modelli free su OpenRouter), quindi non va usata come unica opzione.
2. **`deepseek/deepseek-v4-flash-0731`** (a pagamento) — stesso identico modello, senza rate limit. Scatta se il livello 1 è in rate-limit/timeout. Costo ~$0.14/$0.28 per milione di token (input/output), trascurabile ai volumi previsti (utente singolo).
3. **`google/gemini-3.1-flash-lite`** (a pagamento) — fallback finale se anche DeepSeek (in entrambe le forme) è down. Costo ~$0.25/$1.50 per milione di token — generazione GA più recente della linea Flash-Lite di Google, più economica della precedente Gemini 2.5 Flash inizialmente considerata. Scelto per maturità del supporto JSON strutturato.

**Attenzione allo slug**: usare esattamente `google/gemini-3.1-flash-lite` (GA, stabile). Esiste anche `google/gemini-3.1-flash-lite-preview`, una variante preview separata — non va usata in produzione, verificare su OpenRouter che non sia in stato deprecato/sostituito al momento dell'implementazione.

Il parametro `models` (array ordinato) va quindi popolato con questi 3 slug in questo ordine esatto.

**Nota su Nemotron 3/3.5 (free, NVIDIA)**: valutati e scartati per questo task specifico. Sono modelli validi e alcuni (Nemotron 3 Super) sono esplicitamente posizionati per structured output, ma introdurrebbero un cambio di famiglia di modello senza risolvere un problema reale: il costo residuo con DeepSeek è già trascurabile, quindi non vale il rischio di dover ri-validare comportamento/qualità su un modello diverso. Riconsiderabili in futuro se emergono problemi specifici (es. DeepSeek smette di essere disponibile su OpenRouter).

GPT-4o **escluso** per questo task specifico: costo per token 10-20 volte superiore senza beneficio di qualità misurabile su un task di generazione strutturata con vincoli chiari. Riconsiderabile per la chat Q&A integratori (addendum onboarding, sezione 5.3), dove serve più affidabilità nel seguire istruzioni complesse con tool use (web search), non per questa generazione.

I nomi esatti degli slug modello vanno verificati sul catalogo OpenRouter (`https://openrouter.ai/models`) al momento dell'implementazione, perché le versioni minor possono cambiare slug nel tempo.

**Nota su slug pinnato vs alias `-latest`**: OpenRouter offre per alcune famiglie di modelli un alias con prefisso `~` e suffisso `-latest` (es. `~deepseek/deepseek-v4-flash-latest`), che punta sempre automaticamente all'ultima versione minor rilasciata in quella famiglia (al momento redirige a `deepseek-v4-flash-0731`). È uno slug valido e documentato, non un refuso.

Per questo progetto, **preferire lo slug pinnato specifico** (es. `deepseek/deepseek-v4-flash-0731`) invece dell'alias `-latest`, per coerenza con il vincolo già stabilito al punto 2 (niente selezione automatica del modello fuori dal controllo esplicito): l'alias `-latest` può cambiare il modello effettivamente usato senza intervento né visibilità immediata, se DeepSeek rilascia una nuova minor version. Aggiornare lo slug pinnato è comunque una modifica intenzionale e tracciabile quando si decide di passare a una versione più recente, che è la modalità coerente col resto di questo documento.

## 7. Schema JSON delle 5 proposte pasto

Il modello deve restituire un array di esattamente 5 oggetti, ciascuno con questa struttura:

```json
{
  "proposte": [
    {
      "nome": "string — nome del piatto/pasto",
      "descrizione": "string — breve descrizione, max 2 frasi",
      "ingredienti": [
        { "alimento": "string — deve corrispondere a un alimento nel DB foods", "quantita_g": "number" }
      ],
      "macro": {
        "kcal": "number",
        "proteine_g": "number",
        "carboidrati_g": "number",
        "grassi_g": "number"
      },
      "tipo_pasto": "string — colazione | pranzo | cena | spuntino (coerente col contesto della richiesta)",
      "note_regime": "string — eventuale nota di compatibilità col regime alimentare (es. 'compatibile keto'), opzionale"
    }
  ]
}
```

Vincoli di implementazione:
- Il campo `alimento` in `ingredienti` deve riferirsi ad alimenti effettivamente presenti nel DB `foods` (200-300 alimenti, cfr. PRD principale) — se il modello propone un alimento non presente, va gestito come errore di validazione post-generazione, non silenziosamente ignorato.
- I valori di `macro` restituiti dal modello sono indicativi; l'app deve comunque validarli/ricalcolarli sommando i valori nutrizionali reali degli `ingredienti` dal DB, per coerenza con la scelta già fatta di salvare snapshot macro reali nei log (cfr. PRD principale).
- Se il parsing JSON fallisce o mancano campi obbligatori, applicare il retry già previsto al punto 5.

## 8. Prompt di generazione (system prompt)

Struttura del prompt da inviare al modello, da parametrizzare con i dati reali dell'utente ad ogni chiamata:

```
Sei un assistente nutrizionale. Genera esattamente 5 proposte di pasto che rispettino rigorosamente i vincoli indicati, restituendo SOLO un oggetto JSON conforme allo schema fornito, senza testo aggiuntivo prima o dopo.

DATI UTENTE:
- Obiettivo dieta: {dimagrimento|mantenimento|aumento}
- Regime alimentare: {mediterraneo|keto|paleo|high-carb}
- Target per questo pasto: {kcal} kcal, {proteine_g}g proteine, {carboidrati_g}g carboidrati, {grassi_g}g grassi
- Tipo pasto richiesto: {colazione|pranzo|cena|spuntino}
- Allergie/intolleranze (VINCOLO ASSOLUTO, non violare mai): {lista allergie o "nessuna"}
- Preferenze alimentari (da massimizzare quando possibile, non vincolante): {lista preferenze o "nessuna"}

ALIMENTI DISPONIBILI (usa SOLO questi, con questi nomi esatti):
{lista alimenti dal DB foods, eventualmente filtrata per rilevanza}

REGOLE:
1. Rispetta sempre le allergie elencate: non proporre mai un ingrediente presente in quella lista, nemmeno in tracce.
2. Rispetta i vincoli del regime alimentare selezionato (es. keto = carboidrati bassi).
3. Avvicinati il più possibile ai target macro indicati, con una tolleranza del 10%.
4. Tieni conto delle preferenze alimentari per aumentare la probabilità che il pasto piaccia, ma non è un vincolo assoluto come le allergie.
5. Varia gli ingredienti tra le 5 proposte: evita di riproporre la stessa combinazione con piccole variazioni.
6. Usa solo alimenti dalla lista fornita, con il nome esatto indicato.

Rispondi SOLO con il JSON conforme allo schema, nessun altro testo.
```

Note per Claude Code:
- I placeholder tra `{}` vanno sostituiti a runtime con i dati reali presi da onboarding/profilo utente (addendum onboarding) e dal DB alimenti.
- La lista alimenti disponibili non va mai omessa: è quello che vincola il modello a non inventare alimenti fuori dal DB da 200-300 elementi.
- Questo system prompt è distinto da quello della chat Q&A integratori (addendum onboarding, sezione 5.2-5.3): non riutilizzare lo stesso prompt per compiti diversi.

## 9. Cosa NON fare

- Non implementare `openrouter/auto`.
- Non lasciare che sia il gateway a decidere quale modello usare in base al costo in tempo reale, senza una lista esplicita di modelli approvati da me.
- Non hardcodare un singolo modello senza meccanismo di fallback (punto 3).
