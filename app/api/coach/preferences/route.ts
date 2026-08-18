// ============================================================
// IterUp — GET/PATCH /api/coach/preferences
// ------------------------------------------------------------
// Switch on/off per categoria di trigger, "immediato e visibile, non
// nascosto in sottomenu" (vedi
// PRD-addendum-coach-comportamentale.md sezione 3.1). GET ritorna
// tutti i trigger_type conosciuti (vedi lib/coach-triggers.ts),
// completando con i default (enabled=true) quelli senza ancora una
// riga in coach_preferences. PATCH aggiorna un solo trigger_type per
// chiamata (upsert).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import { ALL_TRIGGER_TYPES, TRIGGER_LABELS, type CoachTriggerType } from "@/lib/coach-triggers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseServer
    .from("coach_preferences")
    .select("*")
    .eq("user_id", CURRENT_USER_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byType = new Map((data ?? []).map((p) => [p.trigger_type, p]));

  const preferences = ALL_TRIGGER_TYPES.map((triggerType) => {
    const existing = byType.get(triggerType);
    return {
      trigger_type: triggerType,
      label: TRIGGER_LABELS[triggerType].label,
      description: TRIGGER_LABELS[triggerType].description,
      enabled: existing?.enabled ?? true,
      preferred_tone: existing?.preferred_tone ?? null,
      satisfaction_score: existing?.satisfaction_score ?? null,
    };
  });

  return NextResponse.json({ preferences });
}

export async function PATCH(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const triggerType = body?.trigger_type;
  const enabled = body?.enabled;

  if (!(ALL_TRIGGER_TYPES as string[]).includes(triggerType)) {
    return NextResponse.json({ error: "trigger_type non valido." }, { status: 400 });
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Il campo 'enabled' deve essere booleano." }, { status: 400 });
  }

  const { error } = await supabaseServer.from("coach_preferences").upsert(
    { user_id: CURRENT_USER_ID, trigger_type: triggerType as CoachTriggerType, enabled },
    { onConflict: "user_id,trigger_type" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
