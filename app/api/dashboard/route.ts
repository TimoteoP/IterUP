// ============================================================
// IterUp — GET /api/dashboard
// ------------------------------------------------------------
// Aggrega gli indicatori per la home page (peso/trend verso
// l'obiettivo, streak abitudini, passi/allenamenti, obiettivi
// attivi, target macro di oggi). Sola lettura, nessuna scrittura.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { DIET_MODES, dietaryRegimeLabel } from "@/lib/nutrition-options";
import { requireApiAuth } from "@/lib/api-auth";
import { calculateTDEE, calculateAge, type ActivityLevel, type Sex } from "@/lib/tdee";
import { calculateBMI, bmiCategory, calculateBodyIndex } from "@/lib/body-indices";
import { calculateStreak } from "@/lib/streak";
import { enrichGoalsWithProgress } from "@/lib/goal-progress";
import type { Tables } from "@/lib/types";

export const dynamic = "force-dynamic";

const HABIT_ACQUIRED_DAYS = 90;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function startOfWeekIso(iso: string): string {
  // Settimana lun-dom.
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=dom, 1=lun...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

/** Regressione lineare semplice (minimi quadrati) su punti {x giorni, y valore}. Ritorna la pendenza (y per unità di x). */
function linearSlope(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const today = todayIso();
  const weekStart = startOfWeekIso(today);
  const monthStart = startOfMonthIso(today);

  const [
    profileResult,
    targetResult,
    weightHistoryResult,
    weightGoalResult,
    habitsResult,
    habitLogsResult,
    activityMonthResult,
    goalsResult,
    dailyLogsResult,
  ] = await Promise.all([
    supabaseServer
      .from("profiles")
      .select("full_name, dietary_regime, sex, birth_date, height_cm, activity_level")
      .eq("id", CURRENT_USER_ID)
      .maybeSingle(),
    supabaseServer
      .from("user_targets")
      .select("mode, daily_kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("body_metrics")
      .select("recorded_at, weight_kg, neck_cm, chest_cm, waist_cm, thigh_cm")
      .eq("user_id", CURRENT_USER_ID)
      .order("recorded_at", { ascending: true }),
    supabaseServer
      .from("goals")
      .select("target_value, created_at")
      .eq("user_id", CURRENT_USER_ID)
      .eq("goal_type", "weight")
      .eq("status", "in_corso")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("habits")
      .select("id, name, type, target_value, unit")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("habit_logs")
      .select("habit_id, recorded_at, completed")
      .eq("user_id", CURRENT_USER_ID)
      .gte("recorded_at", addDaysIso(today, -HABIT_ACQUIRED_DAYS - 5))
      .order("recorded_at", { ascending: false }),
    supabaseServer
      .from("activity_logs")
      .select("recorded_at, steps, workout_type, workout_minutes")
      .eq("user_id", CURRENT_USER_ID)
      .gte("recorded_at", monthStart)
      .lte("recorded_at", today),
    supabaseServer
      .from("goals")
      .select("*")
      .eq("user_id", CURRENT_USER_ID)
      .eq("status", "in_corso")
      .order("created_at", { ascending: true })
      .limit(8),
    supabaseServer
      .from("daily_logs")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", CURRENT_USER_ID)
      .eq("logged_at", today),
  ]);

  for (const r of [
    profileResult,
    targetResult,
    weightHistoryResult,
    weightGoalResult,
    habitsResult,
    habitLogsResult,
    activityMonthResult,
    goalsResult,
    dailyLogsResult,
  ]) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
  }

  // ---- Peso: trend + proiezione verso l'obiettivo ----
  const bodyMetricsHistory = weightHistoryResult.data ?? [];
  const weightHistory = bodyMetricsHistory.filter((r) => r.weight_kg !== null) as {
    recorded_at: string;
    weight_kg: number;
  }[];
  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight_kg : null;
  const goalWeight = weightGoalResult.data?.target_value ?? null;

  const firstWeightDate = weightHistory[0]?.recorded_at;
  const points = firstWeightDate
    ? weightHistory.map((row) => ({
        x: (new Date(row.recorded_at + "T00:00:00Z").getTime() - new Date(firstWeightDate + "T00:00:00Z").getTime()) /
          86400000,
        y: row.weight_kg,
      }))
    : [];
  const slopePerDay = linearSlope(points);
  const trendKgPerWeek = slopePerDay !== null ? Math.round(slopePerDay * 7 * 100) / 100 : null;

  let weeksToGoal: number | null = null;
  let estimatedDate: string | null = null;
  if (currentWeight !== null && goalWeight !== null && trendKgPerWeek !== null && trendKgPerWeek !== 0) {
    const diffToGoal = goalWeight - currentWeight;
    // Il trend porta verso l'obiettivo solo se ha lo stesso segno della distanza da coprire.
    if (Math.sign(diffToGoal) === Math.sign(trendKgPerWeek)) {
      const weeks = diffToGoal / trendKgPerWeek;
      weeksToGoal = Math.max(0, Math.round(weeks));
      estimatedDate = addDaysIso(today, weeksToGoal * 7);
    }
  }
  const kgToGoal = currentWeight !== null && goalWeight !== null ? Math.round((currentWeight - goalWeight) * 10) / 10 : null;

  // ---- Abitudini: streak corrente + % verso i 90 giorni ----
  const habits = habitsResult.data ?? [];
  const logsByHabit = new Map<string, Map<string, boolean>>();
  for (const log of habitLogsResult.data ?? []) {
    if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, new Map());
    logsByHabit.get(log.habit_id)!.set(log.recorded_at, log.completed === true);
  }

  const habitStats = habits.map((h) => {
    const logs = logsByHabit.get(h.id) ?? new Map<string, boolean>();
    const completedToday = logs.get(today) === true;
    const streak = calculateStreak(logs, today);

    return {
      id: h.id,
      name: h.name,
      kind: h.type,
      streakDays: streak,
      acquiredTargetDays: HABIT_ACQUIRED_DAYS,
      pctToAcquired: Math.min(100, Math.round((streak / HABIT_ACQUIRED_DAYS) * 100)),
      completedToday,
    };
  });

  // ---- Attività: passi/allenamenti oggi, settimana, mese ----
  const activityRows = activityMonthResult.data ?? [];
  const stepsToday = activityRows.filter((r) => r.recorded_at === today).reduce((s, r) => s + (r.steps ?? 0), 0);
  const stepsWeek = activityRows
    .filter((r) => r.recorded_at >= weekStart)
    .reduce((s, r) => s + (r.steps ?? 0), 0);
  const stepsMonth = activityRows.reduce((s, r) => s + (r.steps ?? 0), 0);
  const workoutsWeek = activityRows.filter((r) => r.recorded_at >= weekStart && r.workout_type).length;
  const workoutMinutesWeek = activityRows
    .filter((r) => r.recorded_at >= weekStart)
    .reduce((s, r) => s + (r.workout_minutes ?? 0), 0);

  // ---- Obiettivi in corso: current_value/progress_pct calcolati dai
  // dati reali per weight/activity/habit_streak (vedi lib/goal-progress.ts) ----
  const enrichedGoals = await enrichGoalsWithProgress((goalsResult.data ?? []) as Tables<"goals">[]);
  const goals = enrichedGoals.map((g) => ({
    id: g.id,
    title: g.title,
    goalType: g.goal_type,
    targetValue: g.target_value,
    targetDate: g.target_date,
    currentValue: g.current_value,
    progressPct: g.progress_pct,
  }));

  // ---- BMI ----
  const profile = profileResult.data;
  const bmi =
    currentWeight !== null && profile?.height_cm
      ? { value: calculateBMI(currentWeight, profile.height_cm), category: bmiCategory(calculateBMI(currentWeight, profile.height_cm)) }
      : null;

  // ---- Indice Corporeo IterUp: peso + circonferenze, pesati per reattività al dimagrimento (vedi lib/body-indices.ts) ----
  const bodyIndexHistory = calculateBodyIndex(
    bodyMetricsHistory.map((r) => ({
      date: r.recorded_at,
      weightKg: r.weight_kg,
      neckCm: r.neck_cm,
      chestCm: r.chest_cm,
      waistCm: r.waist_cm,
      thighCm: r.thigh_cm,
    }))
  );
  const currentBodyIndex = bodyIndexHistory.length > 0 ? bodyIndexHistory[bodyIndexHistory.length - 1].index : null;
  const firstIndexDate = bodyIndexHistory[0]?.date;
  const bodyIndexSlopePerDay = firstIndexDate
    ? linearSlope(
        bodyIndexHistory.map((p) => ({
          x: (new Date(p.date + "T00:00:00Z").getTime() - new Date(firstIndexDate + "T00:00:00Z").getTime()) / 86400000,
          y: p.index,
        }))
      )
    : null;
  const bodyIndexTrendPerWeek = bodyIndexSlopePerDay !== null ? Math.round(bodyIndexSlopePerDay * 7 * 100) / 100 : null;

  // ---- BMR/TDEE di mantenimento, sempre ricalcolati dal profilo/peso
  // attuale (non salvati in user_targets: quella tabella ha solo le
  // kcal già adattate all'obiettivo) ----
  let maintenance: { bmr: number; tdee: number } | null = null;
  if (
    profile?.sex &&
    profile.birth_date &&
    profile.height_cm &&
    profile.activity_level &&
    currentWeight !== null
  ) {
    const r = calculateTDEE({
      sex: profile.sex as Sex,
      weightKg: currentWeight,
      heightCm: profile.height_cm,
      age: calculateAge(profile.birth_date),
      activityLevel: profile.activity_level as ActivityLevel,
      mode: targetResult.data?.mode ?? "mantenimento",
      dietaryRegime: profile.dietary_regime ?? "mediterraneo",
    });
    maintenance = { bmr: r.bmr, tdee: r.tdee };
  }

  // ---- Target/macro di oggi ----
  const target = targetResult.data;
  const consumed = (dailyLogsResult.data ?? []).reduce(
    (acc, row) => ({
      kcal: acc.kcal + row.kcal,
      protein_g: acc.protein_g + row.protein_g,
      carbs_g: acc.carbs_g + row.carbs_g,
      fat_g: acc.fat_g + row.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return NextResponse.json({
    profile: {
      fullName: profileResult.data?.full_name ?? null,
      dietaryRegimeLabel: dietaryRegimeLabel(profileResult.data?.dietary_regime ?? "mediterraneo"),
    },
    target: target
      ? {
          modeLabel: DIET_MODES.find((m) => m.value === target.mode)?.label ?? target.mode,
          dailyKcal: target.daily_kcal,
          proteinG: target.protein_g,
          carbsG: target.carbs_g,
          fatG: target.fat_g,
        }
      : null,
    maintenance,
    todayMacros: { consumed, target: target ?? null },
    weight: {
      current: currentWeight,
      goal: goalWeight,
      kgToGoal,
      trendKgPerWeek,
      weeksToGoal,
      estimatedDate,
      history: weightHistory.map((r) => ({ date: r.recorded_at, weightKg: r.weight_kg })),
    },
    bmi,
    bodyIndex: {
      current: currentBodyIndex,
      trendPerWeek: bodyIndexTrendPerWeek,
      history: bodyIndexHistory,
    },
    habits: habitStats,
    activity: { stepsToday, stepsWeek, stepsMonth, workoutsWeek, workoutMinutesWeek },
    goals,
  });
}
