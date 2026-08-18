// ============================================================
// IterUp — POST /api/suggest-meal/feedback
// ------------------------------------------------------------
// Salva un giudizio (like/dislike) su una proposta pasto generata da
// A3. La proposta va salvata come snapshot jsonb: potrebbe non essere
// mai stata aggiunta al diario, quindi non è collegabile a un
// daily_logs. Serve a tracciare la qualità percepita nel tempo (vedi
// PRD-addendum-openrouter.md sezione 5, "monitoraggio qualità").
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { TablesInsert, Json } from "@/lib/types";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const { mealType, modelUsed, proposal, liked } = body as Record<string, unknown>;

  if (typeof mealType !== "string" || !mealType) {
    return NextResponse.json({ error: "mealType mancante" }, { status: 400 });
  }
  if (typeof liked !== "boolean") {
    return NextResponse.json({ error: "liked deve essere true/false" }, { status: 400 });
  }
  if (!proposal || typeof proposal !== "object") {
    return NextResponse.json({ error: "proposal mancante" }, { status: 400 });
  }

  const payload: TablesInsert<"meal_suggestion_feedback"> = {
    user_id: CURRENT_USER_ID,
    meal_type: mealType,
    model_used: typeof modelUsed === "string" ? modelUsed : null,
    proposal: proposal as Json,
    liked,
  };

  const { error } = await supabaseServer.from("meal_suggestion_feedback").insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
