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

Usare il parametro **`models`** (array, non singolo `model`) per definire un ordine di fallback esplicito tra 2 modelli scelti a monte:

```json
{
  "models": ["<modello-primario>", "<modello-di-riserva>"],
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

## 6. Modelli candidati (punto di partenza per i test manuali)

Da validare io stesso via playground prima della scelta definitiva, non da implementare "alla cieca":
- Gemini 2.0 / 2.5 Flash
- DeepSeek V3
- GPT-4o mini
- Llama 3.3 70B

Criterio di selezione: costo per chiamata molto basso (siamo su singolo utente, poche chiamate/giorno) + aderenza affidabile al formato JSON richiesto + qualità percepita delle proposte (varietà, coerenza con i macro target, non ripetitività).

## 7. Cosa NON fare

- Non implementare `openrouter/auto`.
- Non lasciare che sia il gateway a decidere quale modello usare in base al costo in tempo reale, senza una lista esplicita di modelli approvati da me.
- Non hardcodare un singolo modello senza meccanismo di fallback (punto 3).
