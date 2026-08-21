// ============================================================
// IterUp — Negative Self-Talk: generazione LLM (classificazione + reframe)
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezioni 4 e 8. Riusa
// lib/openrouter.ts così com'è, stessa catena di modelli già
// validata per suggest-meal/chat integratori/coach comportamentale.
//
// Guardrail applicati in ogni prompt qui sotto (sezione 8
// dell'addendum, esclusa la voce crisis_language su richiesta
// esplicita dell'utente — vedi schema-migration-010):
// 1. Onestà sul pattern cognitivo, mai giudizio sulla persona.
// 2. Nessuna diagnosi clinica in nessun testo generato.
// 4. Il reframe è sempre editabile, mai imposto come "la verità".
// 5. Un pensiero, una distorsione alla volta: mai una lista
//    enumerata di più errori nella stessa risposta.
// ============================================================

import { callOpenRouterJSON } from "@/lib/openrouter";
import { DISTORTION_TYPES, THEME_TAGS, isDistortionType, isThemeTag, type DistortionType, type ThemeTag } from "./self-talk-taxonomy";

const MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "deepseek/deepseek-v4-flash-0731",
  "google/gemini-3.1-flash-lite",
];

const SHARED_CONSTRAINTS = `Sei uno strumento di supporto alla ristrutturazione cognitiva (CBT) in un'app di auto-miglioramento personale, per un singolo utente adulto. Vincoli NON negoziabili:
1. Onestà chirurgica sul PATTERN COGNITIVO, mai giudizio sulla PERSONA: non dire mai che l'utente "è" in un certo modo, solo che questo specifico pensiero mostra un certo pattern.
2. Non sei uno strumento clinico: non fai diagnosi, non usi etichette psichiatriche, non interpreti oltre il testo che l'utente ha scritto.
3. Massimo 1-2 elementi per risposta (distorsioni o suggerimenti): mai una lista lunga di "errori" nello stesso pensiero.
4. Rispondi sempre in italiano.`;

// ------------------------------------------------------------
// Classificazione automatica (quick capture): 1-2 distorsioni più
// probabili + theme, per popolare distortion_tags (source='llm') e
// pre-compilare lo step 1 della sessione guidata ("mostra 1-2 tag
// più probabili, l'utente conferma o corregge").
// ------------------------------------------------------------

interface RawClassification {
  theme: string | null;
  distortions: string[];
}

export interface ClassificationResult {
  theme: ThemeTag | null;
  distortions: DistortionType[];
}

export async function classifyEntry(rawText: string): Promise<ClassificationResult> {
  const distortionList = DISTORTION_TYPES.map((d) => `${d.value}: ${d.description}`).join("\n");
  const themeList = THEME_TAGS.map((t) => t.value).join(", ");

  const systemPrompt = `${SHARED_CONSTRAINTS}

Analizza il pensiero riportato dall'utente qui sotto. Identifica:
- "theme": UNO tra questi valori esatti, quello più pertinente: ${themeList}. Se nessuno è chiaramente pertinente, usa "altro".
- "distortions": al massimo 2 valori (anche 0 o 1 se non ce ne sono di chiare) dalla tassonomia fissa qui sotto, quelli più probabili — non forzare una distorsione se il pensiero non ne mostra una chiara.

Tassonomia distorsioni (usa SOLO questi valori esatti):
${distortionList}

Rispondi SOLO con un oggetto JSON: {"theme": "...", "distortions": ["...", "..."]}.`;

  const { data } = await callOpenRouterJSON<RawClassification>({
    models: MODELS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawText },
    ],
    temperature: 0.3,
  });

  const theme = isThemeTag(data.theme) ? data.theme : null;
  const distortions = (Array.isArray(data.distortions) ? data.distortions : []).filter(isDistortionType).slice(0, 2);

  return { theme, distortions };
}

// ------------------------------------------------------------
// Proposta di reframe (step 5 del flusso guidato): dato il pensiero
// originale + le distorsioni confermate + le evidenze raccolte nei
// passaggi precedenti (a favore, contro, "consider the opposite"),
// propone UN reframe che l'utente può modificare liberamente prima
// di salvare — mai presentato come "la verità corretta".
// ------------------------------------------------------------

interface RawReframe {
  reframe: string;
}

export async function proposeReframe(params: {
  rawText: string;
  distortions: DistortionType[];
  evidenceFor: string;
  evidenceAgainst: string;
  considerOpposite: string;
}): Promise<string> {
  const { rawText, distortions, evidenceFor, evidenceAgainst, considerOpposite } = params;

  const systemPrompt = `${SHARED_CONSTRAINTS}

Proponi UN reframe (massimo 2-3 frasi): una riformulazione più equilibrata e onesta del pensiero originale, che tenga conto delle evidenze raccolte SENZA cadere nella toxic positivity (non deve negare la difficoltà reale, solo restituirle una proporzione onesta). Non è "la versione corretta" definitiva: è un punto di partenza che l'utente modificherà liberamente.

Rispondi SOLO con un oggetto JSON: {"reframe": "il testo proposto"}.`;

  const userPrompt = `Pensiero originale: "${rawText}"
Distorsioni identificate: ${distortions.length ? distortions.join(", ") : "nessuna specifica"}
Evidenza a favore del pensiero: "${evidenceFor || "(nessuna indicata)"}"
Evidenza contro il pensiero: "${evidenceAgainst || "(nessuna indicata)"}"
Cosa ignorerebbe se cercasse solo conferme: "${considerOpposite}"`;

  // NB: il prompt è deliberatamente diviso in system+user (non un
  // unico blocco system) — un system-only in jsonMode ha causato
  // fallimenti riproducibili ("risposta senza content") con almeno
  // un modello della catena durante il testing, verificato in
  // isolamento contro l'API OpenRouter. Vedi stesso fix in
  // lib/coach-messages.ts (generateNudgeMessage).
  const { data } = await callOpenRouterJSON<RawReframe>({
    models: MODELS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
  });

  return data.reframe;
}
