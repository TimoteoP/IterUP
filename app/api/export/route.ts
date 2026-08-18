// ============================================================
// IterUp — GET /api/export
// ------------------------------------------------------------
// Backup completo, sola lettura: JSON con tutte le righe di ogni
// tabella filtrate su CURRENT_USER_ID. Vedi
// PRD-addendum-hardening-completamento.md B2 — senza login né
// sistema di recupero, un errore in una migration o un problema lato
// Supabase può far perdere mesi di storico senza rete di sicurezza.
//
// Tabelle incluse: quelle elencate esplicitamente dall'addendum, più
// meal_suggestion_feedback (dati personali dell'utente non menzionati
// nella lista originale ma comunque filtrati su CURRENT_USER_ID —
// omessa sembra una svista, non una scelta deliberata). Esclusa
// `foods`: catalogo condiviso, non dati personali dell'utente.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const USER_ID_COLUMN: Record<string, string> = {
  profiles: "id",
  user_targets: "user_id",
  daily_logs: "user_id",
  body_metrics: "user_id",
  activity_logs: "user_id",
  habits: "user_id",
  habit_logs: "user_id",
  goals: "user_id",
  supplements: "user_id",
  meal_suggestion_feedback: "user_id",
};

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const tableNames = Object.keys(USER_ID_COLUMN) as (keyof typeof USER_ID_COLUMN)[];

  const results = await Promise.all(
    tableNames.map((table) =>
      supabaseServer
        .from(table)
        .select("*")
        .eq(USER_ID_COLUMN[table], CURRENT_USER_ID)
    )
  );

  const data: Record<string, unknown> = {};
  for (let i = 0; i < tableNames.length; i++) {
    const { data: rows, error } = results[i];
    if (error) {
      return NextResponse.json(
        { error: `Errore esportando ${tableNames[i]}: ${error.message}` },
        { status: 500 }
      );
    }
    data[tableNames[i]] = rows ?? [];
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    user_id: CURRENT_USER_ID,
    data,
  });
}
