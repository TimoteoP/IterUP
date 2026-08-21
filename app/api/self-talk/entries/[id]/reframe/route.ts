// ============================================================
// IterUp — POST /api/self-talk/entries/[id]/reframe
// ------------------------------------------------------------
// Salvataggio definitivo del thought record (vedi
// PRD-addendum-negative-self-talk.md sezione 4, step 6): upsert su
// reframe_sessions (1:1 con entry_id), marca guided_session_completed.
// Il reframe è quello che l'utente ha eventualmente modificato dopo
// la proposta di /reframe/propose — mai imposto come "la verità".
//
// llm_transcript non è popolato in questa versione (flusso guidato
// come wizard strutturato, non chat libera turno-per-turno): il
// campo resta nello schema per coerenza con l'addendum, pronto per
// un'eventuale evoluzione conversazionale futura.
// body: { evidenceFor?, evidenceAgainst?, considerOpposite (obbligatorio),
//         reframeText?, moodAfter? }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import type { TablesInsert } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const considerOpposite = typeof body?.considerOpposite === "string" ? body.considerOpposite.trim() : "";
  if (!considerOpposite) {
    return NextResponse.json({ error: "'considerOpposite' è obbligatorio." }, { status: 400 });
  }

  const moodAfter = body?.moodAfter;
  if (moodAfter !== undefined && moodAfter !== null) {
    if (typeof moodAfter !== "number" || moodAfter < 1 || moodAfter > 10) {
      return NextResponse.json({ error: "moodAfter deve essere un numero tra 1 e 10." }, { status: 400 });
    }
  }

  const { data: entry } = await supabaseServer
    .from("self_talk_entries")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .maybeSingle();

  if (!entry) {
    return NextResponse.json({ error: "Entry non trovata." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const payload: TablesInsert<"reframe_sessions"> = {
    entry_id: params.id,
    user_id: CURRENT_USER_ID,
    evidence_for: typeof body?.evidenceFor === "string" ? body.evidenceFor.trim() || null : null,
    evidence_against: typeof body?.evidenceAgainst === "string" ? body.evidenceAgainst.trim() || null : null,
    consider_opposite: considerOpposite,
    reframe_text: typeof body?.reframeText === "string" ? body.reframeText.trim() || null : null,
    mood_after: moodAfter ?? null,
    completed_at: nowIso,
  };

  const { data: session, error } = await supabaseServer
    .from("reframe_sessions")
    .upsert(payload, { onConflict: "entry_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseServer
    .from("self_talk_entries")
    .update({ guided_session_completed: true })
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID);

  return NextResponse.json({ reframeSession: session });
}
