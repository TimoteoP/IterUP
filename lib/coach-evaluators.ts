// ============================================================
// IterUp — Coach Comportamentale: valutatori per punto di scrittura
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 3: "ogni
// scrittura esistente è il punto in cui valutare se un pattern
// merita un commento". Ogni funzione qui legge i dati necessari,
// chiama i detector puri di lib/coach-triggers.ts, e se un trigger
// scatta lo passa a lib/coach-engine.ts (che applica cap/switch e
// genera il messaggio). Pensate per essere chiamate in modo
// best-effort (mai bloccanti sulla scrittura principale): i
// chiamanti avvolgono queste funzioni in try/catch.
// ============================================================

import { supabaseServer } from "./supabase/server";
import { CURRENT_USER_ID } from "./config";
import { calculateStreak } from "./streak";
import { maybeCreateNudge } from "./coach-engine";
import {
  detectWeightPlateau,
  detectHungerPattern,
  detectHabitMissed,
  detectGoalDelayed,
  detectMealOverTarget,
  detectStreakMilestone,
} from "./coach-triggers";
import type { Tables } from "./types";

// Finestra su cui stimare la baseline storica per "pasto sopra
// target" (sezione 3.1: nessun trigger senza storico sufficiente).
const HISTORY_WINDOW_DAYS = 60;
const MIN_HISTORY_DAYS = 14;
const HUNGER_PATTERN_WINDOW_DAYS = 21;
const WEIGHT_HISTORY_WINDOW_DAYS = 30;
const STREAK_HISTORY_WINDOW_DAYS = 120;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function evaluateAfterLogWrite(newLog: Tables<"daily_logs">): Promise<Tables<"coach_nudges"> | null> {
  if (newLog.kcal <= 0) return null; // digiuno/integrazione: nessun macro, niente da valutare qui

  const today = todayIso();
  const historyCutoff = addDaysIso(today, -HISTORY_WINDOW_DAYS);

  const [targetResult, todayLogsResult, historyLogsResult] = await Promise.all([
    supabaseServer
      .from("user_targets")
      .select("daily_kcal")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer.from("daily_logs").select("kcal").eq("user_id", CURRENT_USER_ID).eq("logged_at", today),
    supabaseServer.from("daily_logs").select("logged_at").eq("user_id", CURRENT_USER_ID).gte("logged_at", historyCutoff),
  ]);

  const targetKcal = targetResult.data?.daily_kcal ?? null;
  const todayKcal = (todayLogsResult.data ?? []).reduce((sum, r) => sum + r.kcal, 0);
  const distinctDays = new Set((historyLogsResult.data ?? []).map((r) => r.logged_at)).size;

  if (targetKcal !== null && distinctDays >= MIN_HISTORY_DAYS) {
    const trigger = detectMealOverTarget(todayKcal, targetKcal, distinctDays);
    if (trigger) {
      const nudge = await maybeCreateNudge(trigger);
      if (nudge) return nudge;
    }
  }

  if (newLog.meal_type === "spuntino") {
    const cutoff = addDaysIso(today, -HUNGER_PATTERN_WINDOW_DAYS);
    const { data } = await supabaseServer
      .from("daily_logs")
      .select("created_at")
      .eq("user_id", CURRENT_USER_ID)
      .eq("meal_type", "spuntino")
      .gte("logged_at", cutoff)
      .not("created_at", "is", null);

    const timestamps = (data ?? []).map((r) => r.created_at).filter((t): t is string => t !== null);
    const trigger = detectHungerPattern(timestamps);
    if (trigger) {
      return maybeCreateNudge(trigger);
    }
  }

  return null;
}

export async function evaluateAfterBodyMetricsWrite(): Promise<Tables<"coach_nudges"> | null> {
  const today = todayIso();
  const cutoff = addDaysIso(today, -WEIGHT_HISTORY_WINDOW_DAYS);

  const { data } = await supabaseServer
    .from("body_metrics")
    .select("recorded_at, weight_kg")
    .eq("user_id", CURRENT_USER_ID)
    .gte("recorded_at", cutoff)
    .not("weight_kg", "is", null)
    .order("recorded_at", { ascending: true });

  const history = (data ?? [])
    .filter((r): r is { recorded_at: string; weight_kg: number } => r.weight_kg !== null)
    .map((r) => ({ recorded_at: r.recorded_at, weight_kg: r.weight_kg }));

  const trigger = detectWeightPlateau(history, today);
  if (!trigger) return null;

  return maybeCreateNudge(trigger);
}

export async function evaluateAfterHabitLogWrite(
  loggedHabitId: string,
  loggedHabitName: string,
  loggedCompleted: boolean | null,
  recordedAt: string
): Promise<Tables<"coach_nudges"> | null> {
  const today = todayIso();

  // 1. Streak milestone sull'abitudine appena loggata (solo se
  // completata oggi: uno streak si misura su giorni completati).
  if (loggedCompleted === true && recordedAt === today) {
    const cutoff = addDaysIso(today, -STREAK_HISTORY_WINDOW_DAYS);
    const { data } = await supabaseServer
      .from("habit_logs")
      .select("recorded_at, completed")
      .eq("habit_id", loggedHabitId)
      .eq("user_id", CURRENT_USER_ID)
      .gte("recorded_at", cutoff);

    const byDate = new Map<string, boolean>();
    for (const row of data ?? []) {
      byDate.set(row.recorded_at, row.completed === true);
    }
    const streak = calculateStreak(byDate, today);
    const trigger = detectStreakMilestone(loggedHabitId, loggedHabitName, streak);
    if (trigger) {
      const nudge = await maybeCreateNudge(trigger);
      if (nudge) return nudge;
    }
  }

  // 2. Abitudine (diversa da quella appena loggata) saltata ieri.
  const yesterday = addDaysIso(today, -1);
  const [habitsResult, loggedYesterdayResult, alreadyFlaggedResult] = await Promise.all([
    supabaseServer.from("habits").select("id, name").eq("user_id", CURRENT_USER_ID).eq("is_active", true),
    supabaseServer.from("habit_logs").select("habit_id").eq("user_id", CURRENT_USER_ID).eq("recorded_at", yesterday),
    supabaseServer
      .from("coach_nudges")
      .select("trigger_data")
      .eq("user_id", CURRENT_USER_ID)
      .eq("trigger_type", "habit_missed")
      .gte("created_at", addDaysIso(today, -7)),
  ]);

  const activeHabits = (habitsResult.data ?? []) as { id: string; name: string }[];
  const loggedYesterday = new Set((loggedYesterdayResult.data ?? []).map((r) => r.habit_id));
  const alreadyFlagged = new Set(
    (alreadyFlaggedResult.data ?? [])
      .map((r) => (r.trigger_data as Record<string, unknown> | null)?.habitId)
      .filter((id): id is string => typeof id === "string")
  );

  const habitMissedTrigger = detectHabitMissed(activeHabits, loggedYesterday, alreadyFlagged, yesterday);
  if (!habitMissedTrigger) return null;

  return maybeCreateNudge(habitMissedTrigger);
}

export async function evaluateGoalDelayed(
  goal: { id: string; title: string; target_date: string | null; created_at: string | null; status: string | null },
  progressPct: number | null
): Promise<Tables<"coach_nudges"> | null> {
  if (goal.status !== "in_corso" || !goal.target_date || !goal.created_at || progressPct === null) {
    return null;
  }

  const trigger = detectGoalDelayed(
    { id: goal.id, title: goal.title, targetDate: goal.target_date, createdAtIso: goal.created_at },
    progressPct,
    todayIso()
  );
  if (!trigger) return null;

  return maybeCreateNudge(trigger, goal.title);
}
