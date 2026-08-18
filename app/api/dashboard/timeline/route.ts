// ============================================================
// IterUp — GET /api/dashboard/timeline?days=7|30|90
// ------------------------------------------------------------
// Aggrega 4 serie giorno per giorno per l'intervallo richiesto — vedi
// PRD-addendum-hardening-completamento.md B3:
// - peso (body_metrics.weight_kg) — null nei giorni senza
//   misurazione (gap visivo, non uno zero implicito).
// - aderenza kcal (%) = kcal consumate / target attivo — null nei
//   giorni senza alcun daily_log (non "hai mangiato 0 kcal").
// - abitudini completate quel giorno / abitudini attive quel giorno —
//   0 è un valore vero (nessuna abitudine fatta), non un gap.
// - minuti di attività totali quel giorno — 0 è un valore vero
//   (nessun allenamento), non un gap.
// Sola lettura.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { calculateStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [7, 30, 90] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function isoRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

export async function GET(request: NextRequest) {
  const daysParam = Number(request.nextUrl.searchParams.get("days"));
  const days = (ALLOWED_DAYS as readonly number[]).includes(daysParam) ? daysParam : 30;

  const today = todayIso();
  const start = addDaysIso(today, -(days - 1));
  const dates = isoRange(start, today);

  const [weightResult, targetResult, logsResult, habitsResult, habitLogsResult, activityResult] = await Promise.all([
    supabaseServer
      .from("body_metrics")
      .select("recorded_at, weight_kg")
      .eq("user_id", CURRENT_USER_ID)
      .gte("recorded_at", start)
      .lte("recorded_at", today),
    supabaseServer
      .from("user_targets")
      .select("daily_kcal")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("daily_logs")
      .select("logged_at, kcal")
      .eq("user_id", CURRENT_USER_ID)
      .gte("logged_at", start)
      .lte("logged_at", today),
    supabaseServer.from("habits").select("id, created_at").eq("user_id", CURRENT_USER_ID).eq("is_active", true),
    // Storico più ampio del solo range richiesto: serve per calcolare
    // correttamente se un'abitudine era "attiva quel giorno" e per lo
    // streak, che guarda indietro nel tempo.
    supabaseServer
      .from("habit_logs")
      .select("habit_id, recorded_at, completed")
      .eq("user_id", CURRENT_USER_ID)
      .lte("recorded_at", today),
    supabaseServer
      .from("activity_logs")
      .select("recorded_at, workout_minutes")
      .eq("user_id", CURRENT_USER_ID)
      .gte("recorded_at", start)
      .lte("recorded_at", today),
  ]);

  for (const r of [weightResult, targetResult, logsResult, habitsResult, habitLogsResult, activityResult]) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
  }

  const weightByDate = new Map<string, number>();
  for (const row of weightResult.data ?? []) {
    if (row.weight_kg !== null) weightByDate.set(row.recorded_at, row.weight_kg);
  }

  const targetKcal = targetResult.data?.daily_kcal ?? null;
  const kcalByDate = new Map<string, number>();
  const hasLogByDate = new Set<string>();
  for (const row of logsResult.data ?? []) {
    hasLogByDate.add(row.logged_at);
    kcalByDate.set(row.logged_at, (kcalByDate.get(row.logged_at) ?? 0) + row.kcal);
  }

  const habits = habitsResult.data ?? [];
  const logsByHabit = new Map<string, Map<string, boolean>>();
  for (const log of habitLogsResult.data ?? []) {
    if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, new Map());
    logsByHabit.get(log.habit_id)!.set(log.recorded_at, log.completed === true);
  }

  const minutesByDate = new Map<string, number>();
  for (const row of activityResult.data ?? []) {
    minutesByDate.set(row.recorded_at, (minutesByDate.get(row.recorded_at) ?? 0) + (row.workout_minutes ?? 0));
  }

  const series = dates.map((date) => {
    const weightKg = weightByDate.get(date) ?? null;

    const kcalAdherencePct =
      targetKcal && hasLogByDate.has(date) ? Math.round(((kcalByDate.get(date) ?? 0) / targetKcal) * 100) : null;

    const activeHabitsThatDay = habits.filter((h) => !h.created_at || h.created_at.slice(0, 10) <= date);
    const habitsCompleted = activeHabitsThatDay.filter(
      (h) => logsByHabit.get(h.id)?.get(date) === true
    ).length;

    const activityMinutes = minutesByDate.get(date) ?? 0;

    return {
      date,
      weightKg,
      kcalAdherencePct,
      habitsCompleted,
      habitsActive: activeHabitsThatDay.length,
      activityMinutes,
    };
  });

  // Streak abitudini "di oggi" per contesto (non una serie giorno per
  // giorno, riusa lib/streak.ts già testato — vedi A6).
  const currentStreaks = habits.map((h) => calculateStreak(logsByHabit.get(h.id) ?? new Map(), today));
  const maxCurrentStreak = currentStreaks.length > 0 ? Math.max(...currentStreaks) : 0;

  return NextResponse.json({ days, series, maxCurrentStreak });
}
