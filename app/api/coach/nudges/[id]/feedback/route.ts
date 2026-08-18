// ============================================================
// IterUp — POST /api/coach/nudges/[id]/feedback
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 3.3: ogni
// messaggio ha un 👍/👎 rapido + "silenzia questo tipo di messaggio".
// Delega la logica (ricalcolo gradimento, riduzione frequenza,
// disattivazione, tono preferito) a lib/coach-engine.ts.
// body: { reaction: "like" | "dislike" | "dismissed" }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { recordNudgeFeedback } from "@/lib/coach-engine";

export const dynamic = "force-dynamic";

const REACTIONS = ["like", "dislike", "dismissed"] as const;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const reaction = body?.reaction;
  if (!(REACTIONS as readonly string[]).includes(reaction)) {
    return NextResponse.json({ error: "reaction deve essere uno tra: like, dislike, dismissed." }, { status: 400 });
  }

  const result = await recordNudgeFeedback(params.id, reaction);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
