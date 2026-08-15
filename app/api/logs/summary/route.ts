// ============================================================
// IterUp — GET /api/logs/summary?date=YYYY-MM-DD
// ------------------------------------------------------------
// Riepilogo "macro residui" per il diario: somma i daily_logs del
// giorno (calcolando i macro al volo via join con `foods`, dato che
// daily_logs non salva uno snapshot — vedi nota supervisore) e li
// confronta con il target attivo in `user_targets`
// (is_active = true, il più recente per created_at in caso di righe
// multiple).
//
// NB: la scrittura/gestione di user_targets è di competenza del
// modulo Obiettivi (A5). Qui lo leggiamo soltanto, in sola lettura,
// per calcolare i residui — nessuna scrittura su questa tabella.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { typedSupabase } from "../typed-client";
import { CURRENT_USER_ID } from "@/lib/config";

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

// Vedi nota in app/api/logs/route.ts: `lib/types.ts` non ha metadati
// di relazione, quindi l'embed `foods(...)` va ritipizzato a mano.
type LogForSummaryRow = {
  quantity_g: number;
  foods: {
    kcal_100g: number;
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
  } | null;
};

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayIso();

  const [logsResult, targetResult] = await Promise.all([
    supabaseServer
      .from("daily_logs")
      .select(
        `quantity_g, foods ( kcal_100g, protein_100g, carbs_100g, fat_100g )`
      )
      .eq("user_id", CURRENT_USER_ID)
      .eq("logged_at", date)
      .returns<LogForSummaryRow[]>(),
    typedSupabase
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
    (acc, row) => {
      const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
      const factor = row.quantity_g / 100;
      return {
        kcal: acc.kcal + (food?.kcal_100g ?? 0) * factor,
        protein_g: acc.protein_g + (food?.protein_100g ?? 0) * factor,
        carbs_g: acc.carbs_g + (food?.carbs_100g ?? 0) * factor,
        fat_g: acc.fat_g + (food?.fat_100g ?? 0) * factor,
      };
    },
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
