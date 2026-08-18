// ============================================================
// IterUp — GET /api/coach/evening
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 5. Stesso
// meccanismo di consegna del rituale mattutino (Shortcut iOS
// pianificato), stessa protezione via token (dati personali nella
// risposta).
//
// Raccoglie macro/kcal, peso/misure di oggi, abitudini, attività,
// avanzamento obiettivi e le "Note del giorno", poi genera un
// messaggio di chiusura — il modello stesso resta sobrio se le note
// contengono segnali di disagio, senza una fase di rilevamento
// separata (vedi lib/coach-messages.ts).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import { enrichGoalsWithProgress } from "@/lib/goal-progress";
import { generateEveningMessage } from "@/lib/coach-messages";
import type { Tables } from "@/lib/types";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSummaryText(params: {
  consumedKcal: number;
  targetKcal: number | null;
  weightToday: number | null;
  habitsTotal: number;
  habitsCompleted: number;
  workoutMinutes: number;
  goals: { title: string; progress_pct: number | null }[];
  journalContent: string | null;
}): string {
  const { consumedKcal, targetKcal, weightToday, habitsTotal, habitsCompleted, workoutMinutes, goals, journalContent } = params;

  const lines = [
    `Calorie di oggi: ${Math.round(consumedKcal)} kcal${targetKcal ? ` (target ${Math.round(targetKcal)} kcal)` : ""}.`,
    weightToday !== null ? `Peso registrato oggi: ${weightToday} kg.` : "Nessuna misurazione del peso oggi.",
    habitsTotal > 0 ? `Abitudini: ${habitsCompleted} su ${habitsTotal} completate oggi.` : "Nessuna abitudine attiva.",
    workoutMinutes > 0 ? `Attività fisica: ${workoutMinutes} minuti di allenamento oggi.` : "Nessun allenamento registrato oggi.",
  ];

  if (goals.length > 0) {
    lines.push(
      `Obiettivi in corso: ${goals.map((g) => `"${g.title}"${g.progress_pct !== null ? ` (${g.progress_pct}%)` : ""}`).join(", ")}.`
    );
  }

  if (journalContent) {
    lines.push(`Note del giorno scritte dall'utente: "${journalContent}"`);
  } else {
    lines.push("L'utente non ha scritto note personali oggi.");
  }

  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const today = todayIso();

  const [logsResult, targetResult, weightResult, habitsResult, habitLogsResult, activityResult, goalsResult, journalResult] =
    await Promise.all([
      supabaseServer.from("daily_logs").select("kcal").eq("user_id", CURRENT_USER_ID).eq("logged_at", today),
      supabaseServer
        .from("user_targets")
        .select("daily_kcal")
        .eq("user_id", CURRENT_USER_ID)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseServer.from("body_metrics").select("weight_kg").eq("user_id", CURRENT_USER_ID).eq("recorded_at", today).maybeSingle(),
      supabaseServer.from("habits").select("id").eq("user_id", CURRENT_USER_ID).eq("is_active", true),
      supabaseServer.from("habit_logs").select("habit_id, completed").eq("user_id", CURRENT_USER_ID).eq("recorded_at", today),
      supabaseServer.from("activity_logs").select("workout_minutes").eq("user_id", CURRENT_USER_ID).eq("recorded_at", today),
      supabaseServer.from("goals").select("*").eq("user_id", CURRENT_USER_ID).eq("status", "in_corso"),
      supabaseServer.from("journal_entries").select("content").eq("user_id", CURRENT_USER_ID).eq("entry_date", today).maybeSingle(),
    ]);

  const consumedKcal = (logsResult.data ?? []).reduce((sum, r) => sum + r.kcal, 0);
  const targetKcal = targetResult.data?.daily_kcal ?? null;
  const weightToday = weightResult.data?.weight_kg ?? null;
  const habitsTotal = (habitsResult.data ?? []).length;
  const habitsCompleted = (habitLogsResult.data ?? []).filter((h) => h.completed === true).length;
  const workoutMinutes = (activityResult.data ?? []).reduce((sum, r) => sum + (r.workout_minutes ?? 0), 0);
  const goalsWithProgress = await enrichGoalsWithProgress((goalsResult.data ?? []) as Tables<"goals">[]);
  const journalContent = journalResult.data?.content ?? null;

  const summaryText = buildSummaryText({
    consumedKcal,
    targetKcal,
    weightToday,
    habitsTotal,
    habitsCompleted,
    workoutMinutes,
    goals: goalsWithProgress.map((g) => ({ title: g.title, progress_pct: g.progress_pct })),
    journalContent,
  });

  const message = await generateEveningMessage(summaryText).catch(
    () => "Un altro giorno registrato: quello che conta è essere tornati qui, non che sia stato perfetto."
  );

  return NextResponse.json({
    date: today,
    message,
    summary: {
      consumedKcal: Math.round(consumedKcal),
      targetKcal,
      weightToday,
      habitsCompleted,
      habitsTotal,
      workoutMinutes,
    },
  });
}
