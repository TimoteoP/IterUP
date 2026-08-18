// ============================================================
// IterUp — /api/supplements/chat
// ------------------------------------------------------------
// Vedi PRD-addendum-onboarding-form.md sezioni 5.2-5.3 e
// PRD-addendum-hardening-completamento.md B1. Chat conversazionale
// libera (non JSON strutturato) sugli integratori, con web search
// grounding obbligatorio (tools: [{"type":"openrouter:web_search"}])
// per evitare di citare studi inventati: requisito hard, non
// opzionale, imposto via system prompt.
//
// GET  -> cronologia persistita (tutta, nessuna paginazione: uso
//         personale, volume ridotto).
// POST { message } -> aggiunge un messaggio utente, chiama il
//         modello con web search, persiste sia il messaggio utente
//         sia la risposta (con citazioni), ritorna la risposta.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { callOpenRouter, type OpenRouterMessage } from "@/lib/openrouter";
import { dietaryRegimeLabel } from "@/lib/nutrition-options";
import type { TablesInsert, Json } from "@/lib/types";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Stessa catena già validata per il generatore pasti (A3) — vedi
// PRD-addendum-openrouter.md sezione 6. Riusata qui per coerenza,
// aggiornabile in futuro se serve un modello più affidabile nel
// seguire istruzioni complesse con tool use.
const MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "deepseek/deepseek-v4-flash-0731",
  "google/gemini-3.1-flash-lite",
];

// Quanti messaggi precedenti includere come contesto ad ogni nuova
// richiesta: limitato per non far crescere il costo/contesto senza
// limite in una chat che resta aperta per settimane.
const HISTORY_CONTEXT_LIMIT = 20;

function buildSystemPrompt(params: {
  supplementsList: string;
  dietaryRegimeLabel: string;
  allergies: string[];
}): string {
  const { supplementsList, dietaryRegimeLabel: regime, allergies } = params;
  return `Sei un assistente che risponde a domande sugli integratori alimentari dell'utente. Non sei un professionista sanitario e le tue risposte non sostituiscono un parere medico/farmacologico: questo va detto chiaramente quando rilevante, non solo assunto implicitamente.

CONTESTO UTENTE:
- Integratori posseduti: ${supplementsList || "nessuno registrato"}
- Regime alimentare: ${regime}
- Allergie/intolleranze: ${allergies.length ? allergies.join(", ") : "nessuna"}

REGOLE VINCOLANTI, NON NEGOZIABILI:
1. Ogni affermazione che presenti un claim su effetti, interazioni o benefici DEVE essere etichettata esplicitamente con [Evidenza scientifica] (specificando il tipo di fonte, es. "studio clinico randomizzato", "revisione sistematica", "meta-analisi") oppure [Anedottico] (uso tradizionale, esperienza personale, nessuna validazione scientifica solida). Non lasciare mai un'affermazione priva di questa etichetta.
2. Quando affermi l'esistenza di uno studio specifico, usa SEMPRE la ricerca web prima di rispondere per verificarne l'esistenza reale. Se la ricerca non produce risultati solidi, dichiara esplicitamente "nessuna fonte verificata trovata" invece di affermare comunque con sicurezza.
3. Non inventare mai nomi di studi, riviste scientifiche o percentuali/numeri specifici senza una fonte verificabile.
4. Rispondi in italiano, in modo conversazionale (non JSON, non elenco puntato forzato se non è naturale).

Rispondi alla domanda dell'utente seguendo queste regole.`;
}

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseServer
    .from("supplement_chat_messages")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Il messaggio non può essere vuoto." }, { status: 400 });
  }

  const [supplementsResult, profileResult, historyResult] = await Promise.all([
    supabaseServer.from("supplements").select("name, dosage, unit, note").eq("user_id", CURRENT_USER_ID),
    supabaseServer.from("profiles").select("dietary_regime, allergies").eq("id", CURRENT_USER_ID).maybeSingle(),
    supabaseServer
      .from("supplement_chat_messages")
      .select("role, content")
      .eq("user_id", CURRENT_USER_ID)
      .order("created_at", { ascending: false })
      .limit(HISTORY_CONTEXT_LIMIT),
  ]);

  if (supplementsResult.error) {
    return NextResponse.json({ error: supplementsResult.error.message }, { status: 500 });
  }
  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }
  if (historyResult.error) {
    return NextResponse.json({ error: historyResult.error.message }, { status: 500 });
  }

  const supplementsList = (supplementsResult.data ?? [])
    .map((s) => [s.name, s.dosage, s.unit].filter(Boolean).join(" — "))
    .join("; ");

  const systemPrompt = buildSystemPrompt({
    supplementsList,
    dietaryRegimeLabel: dietaryRegimeLabel(profileResult.data?.dietary_regime ?? "mediterraneo"),
    allergies: profileResult.data?.allergies ?? [],
  });

  // Cronologia in ordine cronologico (la query sopra è desc per il
  // limit sugli ultimi N, va invertita per l'ordine dei messaggi).
  const historyMessages: OpenRouterMessage[] = (historyResult.data ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Salva il messaggio utente PRIMA di chiamare il modello, così
  // resta in cronologia anche se la chiamata AI fallisce.
  const userInsert: TablesInsert<"supplement_chat_messages"> = {
    user_id: CURRENT_USER_ID,
    role: "user",
    content: message,
    citations: [],
  };
  const { data: userMessage, error: userInsertError } = await supabaseServer
    .from("supplement_chat_messages")
    .insert(userInsert)
    .select()
    .single();

  if (userInsertError) {
    return NextResponse.json({ error: userInsertError.message }, { status: 500 });
  }

  let result;
  try {
    result = await callOpenRouter({
      models: MODELS,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
      tools: [{ type: "openrouter:web_search" }],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore nella chiamata AI", userMessage },
      { status: 502 }
    );
  }

  const assistantInsert: TablesInsert<"supplement_chat_messages"> = {
    user_id: CURRENT_USER_ID,
    role: "assistant",
    content: result.content,
    citations: result.citations as unknown as Json,
  };
  const { data: assistantMessage, error: assistantInsertError } = await supabaseServer
    .from("supplement_chat_messages")
    .insert(assistantInsert)
    .select()
    .single();

  if (assistantInsertError) {
    return NextResponse.json({ error: assistantInsertError.message }, { status: 500 });
  }

  return NextResponse.json({ userMessage, assistantMessage, modelUsed: result.log.modelUsed });
}
