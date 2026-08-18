// ============================================================
// IterUp — calcolo automatico del progresso obiettivi
// ------------------------------------------------------------
// Vedi PRD-addendum-hardening-completamento.md A6. Riusato sia da
// app/api/goals/route.ts sia da app/api/dashboard/route.ts, per non
// duplicare la logica in due posti. current_value/progress_pct sono
// SEMPRE calcolati a runtime dai dati reali, mai persistiti:
// - weight: peso attuale vs baseline (primo peso mai registrato) e
//   target_value.
// - activity: giorni (da quando il goal è stato creato) in cui i
//   passi giornalieri hanno raggiunto target_value.
// - habit_streak: streak corrente dell'abitudine il cui nome è
//   contenuto nel titolo del goal (best-effort: `goals` non ha un
//   habit_id — non possiamo linkarli in modo univoco senza una
//   modifica di schema, esclusa esplicitamente da questo addendum —
//   se il titolo non identifica in modo inequivocabile un'unica
//   abitudine attiva, current_value resta null).
// - custom: nessun calcolo automatico possibile, resta null.
// ============================================================

import { CURRENT_USER_ID } from "./config";
import { supabaseServer } from "./supabase/server";
import { calculateStreak } from "./streak";
import type { Tables } from "./types";

export type GoalWithProgress = Tables<"goals"> & {
  current_value: number | null;
  progress_pct: number | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function enrichGoalsWithProgress(goals: Tables<"goals">[]): Promise<GoalWithProgress[]> {
  const needsWeight = goals.some((g) => g.goal_type === "weight");
  const needsActivity = goals.some((g) => g.goal_type === "activity");
  const needsHabits = goals.some((g) => g.goal_type === "habit_streak");
  const today = todayIso();

  const [weightHistoryResult, activityResult, habitsResult, habitLogsResult] = await Promise.all([
    needsWeight
      ? supabaseServer
          .from("body_metrics")
          .select("recorded_at, weight_kg")
          .eq("user_id", CURRENT_USER_ID)
          .not("weight_kg", "is", null)
          .order("recorded_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    needsActivity
      ? supabaseServer
          .from("activity_logs")
          .select("recorded_at, steps")
          .eq("user_id", CURRENT_USER_ID)
      : Promise.resolve({ data: [], error: null }),
    needsHabits
      ? supabaseServer.from("habits").select("id, name").eq("user_id", CURRENT_USER_ID).eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    needsHabits
      ? supabaseServer.from("habit_logs").select("habit_id, recorded_at, completed").eq("user_id", CURRENT_USER_ID)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const weightHistory = (weightHistoryResult.data ?? []) as { recorded_at: string; weight_kg: number }[];
  const baselineWeight = weightHistory[0]?.weight_kg ?? null;
  const currentWeight = weightHistory[weightHistory.length - 1]?.weight_kg ?? null;

  const stepsByDay = new Map<string, number>();
  for (const row of (activityResult.data ?? []) as { recorded_at: string; steps: number | null }[]) {
    stepsByDay.set(row.recorded_at, (stepsByDay.get(row.recorded_at) ?? 0) + (row.steps ?? 0));
  }

  const habits = (habitsResult.data ?? []) as { id: string; name: string }[];
  const habitLogs = (habitLogsResult.data ?? []) as { habit_id: string; recorded_at: string; completed: boolean | null }[];
  const logsByHabit = new Map<string, Map<string, boolean>>();
  for (const log of habitLogs) {
    if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, new Map());
    logsByHabit.get(log.habit_id)!.set(log.recorded_at, log.completed === true);
  }

  return goals.map((g): GoalWithProgress => {
    if (g.goal_type === "weight") {
      if (currentWeight === null || g.target_value === null) {
        return { ...g, current_value: currentWeight, progress_pct: null };
      }
      let progress_pct: number | null = null;
      if (baselineWeight !== null && baselineWeight !== g.target_value) {
        const total = baselineWeight - g.target_value;
        const done = baselineWeight - currentWeight;
        progress_pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
      }
      return { ...g, current_value: currentWeight, progress_pct };
    }

    if (g.goal_type === "activity" && g.target_value !== null) {
      const createdDate = g.created_at?.slice(0, 10) ?? today;
      let daysOnTarget = 0;
      let daysElapsed = 0;
      const cursor = new Date(createdDate + "T00:00:00Z");
      const end = new Date(today + "T00:00:00Z");
      while (cursor <= end) {
        const iso = cursor.toISOString().slice(0, 10);
        daysElapsed++;
        if ((stepsByDay.get(iso) ?? 0) >= (g.target_value as number)) daysOnTarget++;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return {
        ...g,
        current_value: daysOnTarget,
        progress_pct: daysElapsed > 0 ? Math.round((daysOnTarget / daysElapsed) * 100) : null,
      };
    }

    if (g.goal_type === "habit_streak") {
      const matches = habits.filter((h) => g.title.toLowerCase().includes(h.name.toLowerCase()));
      if (matches.length !== 1) {
        return { ...g, current_value: null, progress_pct: null };
      }
      const habit = matches[0];
      const streak = calculateStreak(logsByHabit.get(habit.id) ?? new Map(), today);
      return {
        ...g,
        current_value: streak,
        progress_pct: g.target_value ? Math.max(0, Math.min(100, Math.round((streak / g.target_value) * 100))) : null,
      };
    }

    return { ...g, current_value: null, progress_pct: null };
  });
}
