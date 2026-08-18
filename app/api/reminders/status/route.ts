// ============================================================
// IterUp — GET /api/reminders/status
// ------------------------------------------------------------
// Vedi PRD-addendum-hardening-completamento.md B4. Nessuna notifica
// push nativa (fuori scope, servirebbe infrastruttura aggiuntiva per
// un'app a singolo utente): questo endpoint viene interrogato da uno
// Shortcut iOS pianificato (automazione "ogni giorno alle 21:00", da
// configurare lato utente — non codice), che mostra una notifica
// locale solo se qualcosa manca ancora oggi.
//
// Sola lettura. Nessun secret/token: espone solo booleani "manca X
// oggi?", nessun dato personale nel payload di risposta.
// ============================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const today = todayIso();

  const [logsResult, weightResult, habitsResult, habitLogsResult] = await Promise.all([
    supabaseServer.from("daily_logs").select("id", { count: "exact", head: true }).eq("user_id", CURRENT_USER_ID).eq("logged_at", today),
    supabaseServer.from("body_metrics").select("weight_kg").eq("user_id", CURRENT_USER_ID).eq("recorded_at", today).maybeSingle(),
    supabaseServer.from("habits").select("id").eq("user_id", CURRENT_USER_ID).eq("is_active", true),
    supabaseServer.from("habit_logs").select("habit_id").eq("user_id", CURRENT_USER_ID).eq("recorded_at", today),
  ]);

  for (const r of [logsResult, weightResult, habitsResult, habitLogsResult]) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
  }

  const diaryEmpty = (logsResult.count ?? 0) === 0;
  const weightMissing = !weightResult.data?.weight_kg;

  const activeHabitIds = new Set((habitsResult.data ?? []).map((h) => h.id));
  const loggedHabitIds = new Set((habitLogsResult.data ?? []).map((h) => h.habit_id));
  const habitsMissing = Array.from(activeHabitIds).some((id) => !loggedHabitIds.has(id));

  const anythingMissing = diaryEmpty || weightMissing || habitsMissing;

  return NextResponse.json({
    date: today,
    diaryEmpty,
    weightMissing,
    habitsMissing,
    anythingMissing,
  });
}
