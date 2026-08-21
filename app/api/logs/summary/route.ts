// ============================================================
// IterUp — GET /api/logs/summary?date=YYYY-MM-DD
// ------------------------------------------------------------
// Riepilogo "macro residui" per il diario: somma i macro già salvati
// come snapshot su daily_logs (kcal/protein_g/carbs_g/fat_g, vedi
// nota in app/api/logs/route.ts) e li confronta con il target attivo
// in `user_targets` (is_active = true, il più recente per created_at
// in caso di righe multiple).
//
// NB: la scrittura/gestione di user_targets è di competenza del
// modulo Obiettivi (A5). Qui lo leggiamo soltanto, in sola lettura,
// per calcolare i residui — nessuna scrittura su questa tabella.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const date = request.nextUrl.searchParams.get("date") ?? todayIso();

  const [logsResult, targetResult] = await Promise.all([
    supabaseServer
      .from("daily_logs")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", CURRENT_USER_ID)
      .eq("logged_at", date),
    supabaseServer
      .from("user_targets")
      .select("id, mode, daily_kcal, protein_g, carbs_g, fat_g, created_at")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (logsResult.error) {
    return NextResponse.json({ error: logsResult.error.message }, { status: 500 });
  }
  if (targetResult.error) {
    return NextResponse.json({ error: targetResult.error.message }, { status: 500 });
  }

  const consumed: MacroTotals = (logsResult.data ?? []).reduce(
    (acc, row) => ({
      kcal: acc.kcal + row.kcal,
      protein_g: acc.protein_g + row.protein_g,
      carbs_g: acc.carbs_g + row.carbs_g,
      fat_g: acc.fat_g + row.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const target = targetResult.data;

  const remaining: MacroTotals | null = target
    ? {
        kcal: target.daily_kcal - consumed.kcal,
        protein_g: target.protein_g - consumed.protein_g,
        carbs_g: target.carbs_g - consumed.carbs_g,
        fat_g: target.fat_g - consumed.fat_g,
      }
    : null;

  return NextResponse.json({
    date,
    consumed,
    target: target
      ? {
          daily_kcal: target.daily_kcal,
          protein_g: target.protein_g,
          carbs_g: target.carbs_g,
          fat_g: target.fat_g,
          mode: target.mode,
        }
      : null,
    remaining,
  });
}
