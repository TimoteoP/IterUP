# Addendum PRD — IterUp: Form di onboarding al primo avvio

Questo documento integra il PRD principale di IterUp e definisce cosa deve raccogliere il form di onboarding mostrato al primo avvio dell'app, e come questi dati devono guidare il motore AI di generazione pasti (vedi anche l'addendum su OpenRouter). Claude Code deve trattare questo come requisito funzionale vincolante, non come bozza.

## 1. Scopo del form

Il form di onboarding serve a costruire il profilo iniziale dell'utente, da cui derivano:
- l'obiettivo dietetico (dimagrimento / mantenimento / aumento)
- i vincoli di sicurezza (allergie) che il motore AI non deve mai violare
- le preferenze di gusto/regime che orientano ma non vincolano in modo assoluto le proposte
- il tipo di regime alimentare da rispettare nella generazione dei pasti

Il form va mostrato una sola volta al primo avvio (dato che per ora l'app ha un solo utente admin, cfr. PRD principale), ma i dati raccolti devono restare modificabili in seguito da una sezione impostazioni/profilo — non è un one-shot immutabile.

## 2. Campi da raccogliere

### 2.1 Dati corporei e obiettivo
- **Peso iniziale** (numero, kg)
- **Peso obiettivo** (numero, kg)
- Da questi due valori l'app deve derivare automaticamente il tipo di dieta:
  - peso obiettivo < peso iniziale → dieta dimagrante
  - peso obiettivo ≈ peso iniziale (entro una soglia di tolleranza, es. ±1-2 kg) → mantenimento
  - peso obiettivo > peso iniziale → dieta di aumento (massa)
- Questo valore derivato alimenta direttamente il calcolo dei target di macro/kcal giornalieri già previsto nel PRD principale.

### 2.2 Regime alimentare
Selezione (singola scelta) tra almeno queste opzioni:
- Mediterraneo (default/baseline)
- Keto
- Paleo
- High-carb
- (lasciare il campo estendibile: in futuro potrebbero aggiungersi altri regimi, quindi implementarlo come enum/lista configurabile, non hardcoded in più punti del codice)

Questo valore determina i vincoli di composizione macro che il motore AI deve rispettare quando genera le proposte pasto (es. keto → basso carboidrati, alto grassi).

### 2.3 Allergie e intolleranze
- Campo per allergie/intolleranze specifiche (es. lattosio, glutine, frutta a guscio, crostacei, ecc.)
- Da trattare come **vincolo hard**, non come preferenza: il motore AI non deve mai proporre pasti contenenti ingredienti presenti in questa lista. Questo va enforced sia nel prompt inviato all'LLM sia, se possibile, con un controllo post-generazione lato app che scarti/segnali proposte contenenti alimenti in blacklist.

### 2.4 Preferenze alimentari
- Campo per preferenze di gusto (alimenti graditi, alimenti da evitare per gusto personale, non per allergia)
- Da trattare come **vincolo soft**: il motore AI deve tenerne conto per aumentare la probabilità che le proposte piacciano, ma non è un blocco come le allergie.

## 3. Tipi di "pasto" da prevedere

Oltre ai pasti standard (colazione, pranzo, cena, spuntini — già previsti nel PRD principale), il form/sistema deve prevedere due voci aggiuntive da trattare come tipo di pasto a tutti gli effetti nel tracking giornaliero:

- **Digiuno**: va registrato come una voce specifica di pasto (non come "assenza di pasto"), in modo che compaia nello storico/statistiche e possa essere considerato dal motore AI nella pianificazione (es. finestre di digiuno intermittente).
- **Integrazione (integratori)**: va prevista come voce di pasto a sé stante, distinta dai pasti "solidi". A differenza del digiuno, l'integrazione richiede una generazione AI (vedi sezione 4): l'utente inserisce l'elenco dei prodotti/integratori che possiede (nome prodotto, eventualmente dosaggio per unità se disponibile sull'etichetta) e il motore AI propone quanti e in quale combinazione assumerli.

Implementazione: il campo "tipo pasto" nel modello dati (`daily_logs` o struttura equivalente già definita nel PRD principale) deve includere questi due valori nell'enum dei tipi di pasto, non trattarli come eccezioni gestite a parte nel codice. Serve inoltre una tabella/struttura dati separata per l'elenco integratori posseduti dall'utente (nome, eventuale dosaggio/unità, eventuale nota tipo "da prendere a stomaco pieno"), gestita dall'utente in una sezione dedicata (probabilmente nel profilo/impostazioni), da cui il motore AI pesca per formulare le proposte.

## 4. Collegamento con il motore AI (OpenRouter)

I dati raccolti da questo form vanno inclusi nel prompt/contesto inviato all'LLM per la generazione delle 5 proposte pasto (vedi addendum PRD su OpenRouter), in particolare:
- target macro/kcal derivati da peso iniziale/obiettivo
- regime alimentare selezionato (vincolo di composizione)
- allergie (vincolo hard, da rispettare sempre)
- preferenze (vincolo soft, da massimizzare quando possibile)

Il **digiuno** non richiede generazione via LLM: è una voce di log diretta, senza macro da assegnare.

L'**integrazione** invece richiede una generazione AI dedicata, distinta dalla generazione delle 5 proposte pasto: dato l'elenco degli integratori posseduti dall'utente (sezione 3) più il profilo (obiettivo, regime alimentare, eventuali allergie/intolleranze), il motore AI deve proporre quantità e combinazione di assunzione. Va quindi previsto un secondo tipo di richiesta al motore AI (prompt diverso da quello delle proposte pasto, ma stesso meccanismo OpenRouter/fallback descritto nell'addendum dedicato), il cui output è strutturato come: lista di prodotti selezionati tra quelli posseduti, quantità/dosaggio consigliato per ciascuno, eventuale timing di assunzione (es. "a stomaco pieno", "al mattino").

## 5. Gestione integratori: form nelle impostazioni e chat Q&A

### 5.1 Form di inserimento integratori (sezione impostazioni utente)

Nelle impostazioni utente va previsto un form CRUD (aggiungi/modifica/elimina) per gli integratori posseduti, distinto dal form di onboarding iniziale. Ogni voce integratore ha almeno questi campi:

- **Nome prodotto** (es. "Berberina")
- **Principio attivo e dosaggio** (es. "Berberina HCL 500mg") — campo testuale libero ma strutturato, che rappresenti sostanza + quantità per unità
- **Formato/unità di assunzione** (es. "1 capsula") — quante unità corrispondono al dosaggio indicato

Esempio concreto (ricalca l'input reale dell'utente):
```
Nome: Berberina
Principio attivo/dosaggio: Berberina HCL 500mg
Unità: 1 capsula
```
```
Nome: Curcumina
Principio attivo/dosaggio: Curcuminoidi 350mg
Unità: 1 capsula
```

Questa tabella/struttura dati è quella già menzionata alla sezione 3 come fonte da cui il motore AI pesca per generare le proposte di combinazione/quantità.

### 5.2 Chat Q&A collegata all'LLM nella sezione integrazione

Nella sezione "Integrazione" dell'app, oltre alla generazione automatica delle proposte (sezione 4), va previsto un **tasto che apre una finestra di chat libera** collegata a un LLM (stesso meccanismo OpenRouter/fallback delle altre chiamate AI), dove l'utente può fare domande testuali libere sui propri integratori. Esempio reale: *"Posso prendere la curcumina con la berberina o è meglio separarle?"*

Requisiti funzionali:
- La chat deve avere accesso in contesto all'elenco integratori dell'utente (sezione 5.1) e al profilo (allergie, obiettivo, eventuali farmaci se in futuro previsti), così da rispondere in modo pertinente senza che l'utente debba ripetere le informazioni ogni volta.
- È una chat conversazionale libera (turni multipli), non un form strutturato: l'output non deve essere forzato in JSON come per le proposte pasto/integrazione, ma testo naturale.
- **Ogni risposta della chat deve dichiarare esplicitamente il livello di evidenza**: se il parere espresso è supportato da studi scientifici (citando almeno la fonte/tipo di studio, es. "studio clinico randomizzato", "revisione sistematica") oppure se si tratta solo di evidenza aneddotica/uso tradizionale senza validazione scientifica solida. Questo va imposto via system prompt come requisito non negoziabile della risposta, non lasciato alla buona volontà del modello.
- Va mostrato in modo chiaro all'utente che le risposte sono generate da un LLM e non sostituiscono un parere medico/farmacologico — disclaimer visibile nella UI della chat, non solo nel PRD.
- Non serve persistenza a lungo termine della cronologia chat tra sessioni diverse in questa fase (coerente con l'MVP "un solo utente, niente gestione complessa" del PRD principale), ma la sessione corrente deve mantenere il contesto tra un messaggio e l'altro.

### 5.3 Nota tecnica critica: rischio di citazioni inventate

Un LLM standard, senza accesso al web, può "allucinare" studi che non esistono o citarli in modo impreciso — è un rischio noto e documentato dei modelli linguistici. Chiedere di distinguere "studi scientifici" da "evidenza aneddotica" **non basta da solo** a garantire che gli studi citati siano reali.

Per mitigare questo rischio, Claude Code deve implementare la chat integratori usando la **web search grounding di OpenRouter**, non una chiamata "nuda" al modello:
- aggiungere `{"type": "openrouter:web_search"}` all'array `tools` della richiesta (meccanismo standard e attuale di OpenRouter, sostituisce il vecchio plugin `web`/suffisso `:online`), così il modello può cercare sul web prima di rispondere quando ritiene necessario verificare l'esistenza di uno studio
- le risposte con grounding includono citazioni con URL verificabili (annotazioni `url_citation`), che vanno mostrate in UI come link cliccabili sotto la risposta, non solo come testo
- il system prompt deve istruire il modello a usare la ricerca web ogni volta che afferma l'esistenza di uno studio specifico, e a dichiarare esplicitamente "nessuna fonte verificata trovata" se la ricerca non produce risultati solidi, invece di affermare comunque con sicurezza

Questo comporta un costo per chiamata leggermente più alto (la ricerca web ha una tariffa a parte rispetto alla sola inferenza del modello), accettabile visto il volume d'uso previsto (utente singolo).

## 6. Cosa NON fare

- Non hardcodare le allergie/preferenze come stringa libera non strutturata se possibile: preferire una lista strutturata (anche semplice) per poter fare controlli automatici post-generazione.
- Non trattare digiuno e integrazione come "casi speciali" gestiti con logica condizionale sparsa nel codice: vanno modellati come valori dell'enum tipo-pasto fin dall'inizio, per coerenza con il resto del data model.
- Non rendere il form un one-shot immutabile: i dati vanno editabili da un'area profilo/impostazioni successiva.
- Non presentare le risposte della chat Q&A sugli integratori come parere medico definitivo senza disclaimer visibile in UI: è un LLM generico, non un professionista sanitario.
- Non implementare la chat integratori con una chiamata LLM "nuda" senza web search grounding: il rischio di citare studi inesistenti o imprecisi è concreto e va mitigato come da sezione 5.3, non ignorato.
