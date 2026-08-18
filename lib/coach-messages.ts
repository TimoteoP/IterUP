// ============================================================
// IterUp — Coach Comportamentale: generazione messaggi (LLM)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezioni 2, 3.2, 4, 5.
// Riusa lib/openrouter.ts così com'è, stessa catena di modelli già
// validata per suggest-meal e la chat integratori (scelta esplicita
// dell'utente in quella sede, riapplicata qui per coerenza) — vedi
// PRD-addendum-openrouter.md sezione 6.
// ============================================================

import { callOpenRouterJSON, callOpenRouter } from "@/lib/openrouter";
import type { CoachTriggerType } from "./coach-triggers";

const MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "deepseek/deepseek-v4-flash-0731",
  "google/gemini-3.1-flash-lite",
];

// Vincoli trasversali, validi per OGNI messaggio del coach (nudge,
// mattina, sera) — vedi addendum sezione 2. Ripetuti in ogni prompt
// invece che "sperare" che il modello li ricordi da un turno
// all'altro: ogni chiamata è stateless.
const SHARED_CONSTRAINTS = `Sei il coach comportamentale di IterUp, un'app di tracking per un singolo utente. Vincoli NON negoziabili per ogni messaggio che scrivi:
1. Mai linguaggio di colpa o vergogna legato a cibo, peso o mancata performance ("hai sgarrato", "disciplina", "dovresti vergognarti").
2. Mai trattare un singolo dato come giudizio definitivo (un pasto, un giorno, una misurazione): riconosci esplicitamente il rumore statistico quando rilevante.
3. Mai "toxic positivity" generica ("ce la puoi fare!" senza contenuto): ogni messaggio contiene o un dato reinquadrato o un'azione concreta, mai le due cose vuote insieme.
4. Non sei uno strumento clinico: non interpreti, non etichetti, non fai diagnosi su ciò che l'utente scrive. Il tuo perimetro è il supporto all'aderenza agli obiettivi che l'utente ha scelto, non il supporto psicologico clinico.
5. Rispondi sempre in italiano, breve (2-4 frasi), mai un elenco puntato.`;

interface TriggerPromptSpec {
  principle: string;
  toneHint: string;
}

const TRIGGER_SPECS: Record<CoachTriggerType, TriggerPromptSpec> = {
  weight_plateau: {
    principle:
      "Principio: rinforzo sul processo, non sul risultato (self-efficacy, Bandura). Il peso è un output rumoroso; l'aderenza al processo è l'unica cosa che l'utente controlla davvero.",
    toneHint: "Reinquadra il dato (il peso stabile non è un fallimento) e riconosci lo sforzo di processo.",
  },
  hunger_pattern: {
    principle:
      "Principio: antecedent design (CBT). Un pattern orario ricorrente si affronta progettando l'ambiente in anticipo (uno spuntino pianificato), non con la forza di volontà.",
    toneHint: "Suggerisci un'azione pratica e concreta legata alla fascia oraria rilevata, senza giudicare il pattern.",
  },
  habit_missed: {
    principle:
      "Principio: 'never miss twice'. Un salto isolato non deve rompere psicologicamente lo streak se reinquadrato subito come eccezione, non come fallimento.",
    toneHint: "Normalizza il salto in una frase, poi invita a riprendere oggi stesso senza insistere sul passato.",
  },
  goal_delayed: {
    principle:
      "Principio: implementation intentions (Gollwitzer). Aiuta a ridefinire un prossimo passo concreto (quando/dove/come), non a 'motivare' in astratto.",
    toneHint: "Proponi un passo specifico e immediato verso l'obiettivo, ancorato a un momento concreto della giornata.",
  },
  meal_over_target: {
    principle:
      "Principio: separazione comportamento/identità. Un pasto è un dato dentro una media settimanale, non un fallimento personale.",
    toneHint:
      "Il più delicato: riconosci il dato con calma assoluta, ricorda che è la media settimanale che conta, nessun tono correttivo o da 'devi rimediare'.",
  },
  streak_milestone: {
    principle: "Principio: milestone reinforcement, con parsimonia — un riconoscimento breve, non una celebrazione sproporzionata.",
    toneHint: "Breve, concreto, riconosce la costanza mostrata senza esagerare.",
  },
};

export interface NudgeMessageResult {
  message: string;
  category: CoachTriggerType;
  toneUsed: string;
}

interface RawNudgeResponse {
  message: string;
  tone_used: string;
}

export async function generateNudgeMessage(params: {
  triggerType: CoachTriggerType;
  triggerData: Record<string, unknown>;
  preferredTone: string | null;
  goalTitle?: string | null;
}): Promise<NudgeMessageResult> {
  const { triggerType, triggerData, preferredTone, goalTitle } = params;
  const spec = TRIGGER_SPECS[triggerType];

  const toneInstruction = preferredTone
    ? `Tono preferito da questo utente (appreso dal feedback passato): ${preferredTone}.`
    : "Nessun tono preferito ancora appreso: scegli tra 'diretto/pratico' o 'riflessivo' in base al trigger.";

  const goalContext = goalTitle
    ? `Se pertinente, puoi far riferimento a questo obiettivo scritto letteralmente dall'utente (citalo con le sue parole, non parafrasare in una frase preconfezionata): "${goalTitle}".`
    : "";

  const systemPrompt = `${SHARED_CONSTRAINTS}

CONTESTO DEL MESSAGGIO DA SCRIVERE:
- Trigger rilevato: ${triggerType}
- ${spec.principle}
- Indicazione di tono: ${spec.toneHint}
- Dati grezzi rilevati: ${JSON.stringify(triggerData)}
- ${toneInstruction}
- ${goalContext}

Rispondi SOLO con un oggetto JSON: {"message": "il messaggio da mostrare in italiano", "tone_used": "diretto" oppure "riflessivo"}.`;

  const { data } = await callOpenRouterJSON<RawNudgeResponse>({
    models: MODELS,
    messages: [{ role: "system", content: systemPrompt }],
    temperature: 0.7,
  });

  return { message: data.message, category: triggerType, toneUsed: data.tone_used };
}

// ------------------------------------------------------------
// Rituale del mattino
// ------------------------------------------------------------
const MORNING_SYSTEM_PROMPT = `${SHARED_CONSTRAINTS}

Scrivi una breve riflessione motivante ORIGINALE (2-3 frasi), ancorata a UN principio comportamentale specifico (piccoli passi, consistenza, o auto-efficacia — scegline uno). VINCOLO CRITICO: non citare MAI un aneddoto storico, una frase attribuita a una persona reale, o un evento con dettagli verificabili — un modello linguistico può inventare dettagli plausibili ma falsi con facilità, ed è un rischio di accuratezza inaccettabile qui. La riflessione deve essere generata da te, non una citazione.

Rispondi SOLO con testo semplice (la riflessione), nessun JSON, nessun titolo.`;

export async function generateMorningReflection(): Promise<string> {
  const result = await callOpenRouter({
    models: MODELS,
    messages: [{ role: "system", content: MORNING_SYSTEM_PROMPT }],
    temperature: 0.8,
  });
  return result.content.trim();
}

// ------------------------------------------------------------
// Rituale della sera
// ------------------------------------------------------------
// Il giudizio "le note contengono segnali di disagio reale" è del
// modello stesso, nella stessa chiamata: non c'è una fase separata di
// rilevamento a monte (nessuna capacità NLP dedicata qui, e comunque
// aggiungerebbe una seconda interpretazione automatica di un testo
// personale, che è esattamente ciò che l'addendum vieta — vedi
// sezione 2, "il coach non interpreta ciò che l'utente scrive").
const EVENING_SYSTEM_PROMPT = `${SHARED_CONSTRAINTS}

Scrivi un messaggio di chiusura della giornata (2-4 frasi) a partire dai dati forniti dall'utente qui sotto. Vincoli specifici per questo messaggio:
- Consolidamento, non energia: chiusura calma, mai "hype" (un tono troppo energico la sera rischia di interferire con l'addormentamento).
- Nessuna lista di cose da migliorare: la sera si riconosce quello che è successo, senza checklist di correzioni.
- Il messaggio deve cambiare in modo percepibile in base ai dati forniti: non un template fisso.
- Se tra i dati forniti c'è un testo libero scritto dall'utente ("Note del giorno") e quel testo contiene segnali di possibile disagio reale (non solo "giornata no"): NON provare a interpretarlo, etichettarlo o commentarlo, e non fare da terapeuta. Limitati a un tono più sobrio e discreto in questo messaggio, senza mai citare o parafrasare cosa l'utente ha scritto.

Rispondi SOLO con testo semplice (il messaggio), nessun JSON, nessun titolo.`;

export async function generateEveningMessage(summaryText: string): Promise<string> {
  const result = await callOpenRouter({
    models: MODELS,
    messages: [
      { role: "system", content: EVENING_SYSTEM_PROMPT },
      { role: "user", content: summaryText },
    ],
    temperature: 0.7,
  });
  return result.content.trim();
}
