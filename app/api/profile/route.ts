// ============================================================
// IterUp — GET /api/profile
// ------------------------------------------------------------
// Legge il profilo corrente + peso più recente + target attivo, per
// precompilare il form di modifica in /impostazioni (i dati
// dell'onboarding restano editabili, vedi
// PRD-addendum-onboarding-form.md sezione 1). Il salvataggio resta
// unificato su POST /api/onboarding/save (upsert), qui solo lettura.
// ============================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const [profileResult, weightResult, targetResult] = await Promise.all([
    supabaseServer.from("profiles").select("*").eq("id", CURRENT_USER_ID).maybeSingle(),
    supabaseServer
      .from("body_metrics")
      .select("weight_kg, recorded_at")
      .eq("user_id", CURRENT_USER_ID)
      .not("weight_kg", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("user_targets")
      .select("mode")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: profileResult.data,
    latestWeightKg: weightResult.data?.weight_kg ?? null,
    activeMode: targetResult.data?.mode ?? null,
  });
}
