// ============================================================
// IterUp — GET /api/coach/nudges
// ------------------------------------------------------------
// Ultimi nudge generati dal motore di trigger (vedi
// PRD-addendum-coach-comportamentale.md sezione 3), per la card
// "Il tuo coach oggi" in dashboard. Sola lettura: i nudge vengono
// creati inline dalle route di scrittura esistenti (logs,
// body-metrics, habits/log) e dalla valutazione periodica su goals,
// non da qui.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseServer
    .from("coach_nudges")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ nudges: data ?? [] });
}
