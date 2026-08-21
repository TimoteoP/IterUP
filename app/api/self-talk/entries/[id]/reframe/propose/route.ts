// ============================================================
// IterUp — POST /api/self-talk/entries/[id]/reframe/propose
// ------------------------------------------------------------
// Step 5 del flusso guidato (vedi
// PRD-addendum-negative-self-talk.md sezione 4): propone un reframe
// a partire da quanto raccolto nei passaggi precedenti. NON
// persiste nulla — il salvataggio definitivo (con reframe
// eventualmente modificato dall'utente) passa da
// POST /api/self-talk/entries/[id]/reframe.
// body: { distortions?: string[], evidenceFor?, evidenceAgainst?,
//         considerOpposite: string (obbligatorio, step non saltabile) }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import { isDistortionType } from "@/lib/self-talk-taxonomy";
import { proposeReframe } from "@/lib/self-talk-messages";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const considerOpposite = typeof body?.considerOpposite === "string" ? body.considerOpposite.trim() : "";
  if (!considerOpposite) {
    return NextResponse.json(
      { error: "'considerOpposite' è obbligatorio: cosa ignoreresti se cercassi solo conferme?" },
      { status: 400 }
    );
  }

  const { data: entry } = await supabaseServer
    .from("self_talk_entries")
    .select("raw_text")
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .maybeSingle();

  if (!entry) {
    return NextResponse.json({ error: "Entry non trovata." }, { status: 404 });
  }

  const distortions = Array.isArray(body?.distortions) ? body.distortions.filter(isDistortionType) : [];
  const evidenceFor = typeof body?.evidenceFor === "string" ? body.evidenceFor.trim() : "";
  const evidenceAgainst = typeof body?.evidenceAgainst === "string" ? body.evidenceAgainst.trim() : "";

  try {
    const reframeText = await proposeReframe({
      rawText: entry.raw_text,
      distortions,
      evidenceFor,
      evidenceAgainst,
      considerOpposite,
    });
    return NextResponse.json({ reframeText });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore nella generazione del reframe" },
      { status: 502 }
    );
  }
}
