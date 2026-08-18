// ============================================================
// IterUp — Coach Comportamentale: rilevamento pattern (pure)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 3. Ogni
// funzione qui è pura (nessun I/O, nessuna chiamata a Supabase o
// OpenRouter): riceve dati già letti dal chiamante e ritorna al più
// un TriggerResult. La logica di guardrail (cap di frequenza, switch
// on/off, baseline storica) vive in lib/coach-engine.ts, che orchestra
// lettura dati + queste funzioni + generazione messaggio.
//
// "Non è un sistema che impara la psicologia dell'utente" (vedi
// sezione 1 dell'addendum): regole esplicite, non ML.
// ============================================================

export type CoachTriggerType =
  | "weight_plateau"
  | "hunger_pattern"
  | "habit_missed"
  | "goal_delayed"
  | "meal_over_target"
  | "streak_milestone";

export interface TriggerResult {
  triggerType: CoachTriggerType;
  data: Record<string, unknown>;
}

export const ALL_TRIGGER_TYPES: CoachTriggerType[] = [
  "weight_plateau",
  "hunger_pattern",
  "habit_missed",
  "goal_delayed",
  "meal_over_target",
  "streak_milestone",
];

/** Etichette in italiano per la UI (switch on/off in Impostazioni). */
export const TRIGGER_LABELS: Record<CoachTriggerType, { label: string; description: string }> = {
  weight_plateau: { label: "Peso stabile", description: "Quando il peso è sceso poco o è stabile su più settimane." },
  hunger_pattern: { label: "Pattern orario di fame", description: "Quando emerge un orario ricorrente di spuntini non pianificati." },
  habit_missed: { label: "Abitudine saltata", description: "Al primo salto isolato di un'abitudine attiva." },
  goal_delayed: { label: "Obiettivo in ritardo", description: "Quando il ritmo di avanzamento non è in linea con la scadenza." },
  meal_over_target: { label: "Pasto sopra target", description: "Quando le calorie del giorno superano di molto il target." },
  streak_milestone: { label: "Streak raggiunta", description: "Alle milestone di costanza (7/30/90 giorni)." },
};

/** Pendenza (per unità di x) di una regressione lineare ai minimi quadrati. */
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

function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const to = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86_400_000);
}

// ------------------------------------------------------------
// 1. Peso sceso ma poco / stabile
// ------------------------------------------------------------
const WEIGHT_PLATEAU_WINDOW_DAYS = 21;
const WEIGHT_PLATEAU_MIN_POINTS = 3;
const WEIGHT_PLATEAU_MIN_SPAN_DAYS = 14;
// Zona "poco/stabile": da un calo minimo a un lieve aumento (rumore
// di bilancia). Sotto questa soglia è un calo netto (nessun nudge
// necessario); sopra è un aumento (fuori scope di questo trigger).
const WEIGHT_PLATEAU_SLOPE_MIN_KG_WEEK = -0.15;
const WEIGHT_PLATEAU_SLOPE_MAX_KG_WEEK = 0.05;

export function detectWeightPlateau(
  history: { recorded_at: string; weight_kg: number }[],
  todayIso: string
): TriggerResult | null {
  const windowStart = daysBetweenIso("1970-01-01", todayIso) - WEIGHT_PLATEAU_WINDOW_DAYS;
  const recent = history.filter(
    (h) => daysBetweenIso("1970-01-01", h.recorded_at) >= windowStart
  );
  if (recent.length < WEIGHT_PLATEAU_MIN_POINTS) return null;

  const spanDays = daysBetweenIso(recent[0].recorded_at, recent[recent.length - 1].recorded_at);
  if (spanDays < WEIGHT_PLATEAU_MIN_SPAN_DAYS) return null;

  const points = recent.map((h) => ({ x: daysBetweenIso("1970-01-01", h.recorded_at), y: h.weight_kg }));
  const slopePerDay = linearSlope(points);
  if (slopePerDay === null) return null;
  const slopePerWeek = Math.round(slopePerDay * 7 * 100) / 100;

  if (slopePerWeek < WEIGHT_PLATEAU_SLOPE_MIN_KG_WEEK || slopePerWeek > WEIGHT_PLATEAU_SLOPE_MAX_KG_WEEK) {
    return null;
  }

  return {
    triggerType: "weight_plateau",
    data: { slopeKgPerWeek: slopePerWeek, pointsUsed: recent.length, spanDays },
  };
}

// ------------------------------------------------------------
// 2. Pattern orario di fame (spuntini ricorrenti in una fascia oraria)
// ------------------------------------------------------------
const HUNGER_PATTERN_BUCKET_HOURS = 2;
const HUNGER_PATTERN_MIN_DISTINCT_DAYS = 3;

/**
 * @param snackTimestamps timestamp ISO (created_at) dei log con
 *   meal_type 'spuntino' nelle ultime settimane.
 */
export function detectHungerPattern(snackTimestamps: string[]): TriggerResult | null {
  // giorno -> fascia oraria vista quel giorno (un giorno conta una
  // volta sola per fascia, per non far pesare più spuntini nello
  // stesso giorno come se fossero giorni diversi).
  const daysByBucket = new Map<number, Set<string>>();

  for (const ts of snackTimestamps) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = Math.floor(d.getUTCHours() / HUNGER_PATTERN_BUCKET_HOURS) * HUNGER_PATTERN_BUCKET_HOURS;
    const dayKey = d.toISOString().slice(0, 10);
    if (!daysByBucket.has(bucket)) daysByBucket.set(bucket, new Set());
    daysByBucket.get(bucket)!.add(dayKey);
  }

  let bestBucket: number | null = null;
  let bestCount = 0;
  for (const [bucket, days] of Array.from(daysByBucket)) {
    if (days.size > bestCount) {
      bestCount = days.size;
      bestBucket = bucket;
    }
  }

  if (bestBucket === null || bestCount < HUNGER_PATTERN_MIN_DISTINCT_DAYS) return null;

  return {
    triggerType: "hunger_pattern",
    data: { hourBucketStart: bestBucket, hourBucketEnd: bestBucket + HUNGER_PATTERN_BUCKET_HOURS, daysCount: bestCount },
  };
}

// ------------------------------------------------------------
// 3. Abitudine saltata (assenza di log ieri per un'abitudine attiva)
// ------------------------------------------------------------
export function detectHabitMissed(
  activeHabits: { id: string; name: string }[],
  loggedHabitIdsYesterday: Set<string>,
  alreadyFlaggedHabitIds: Set<string>,
  yesterdayIso: string
): TriggerResult | null {
  const missed = activeHabits.find(
    (h) => !loggedHabitIdsYesterday.has(h.id) && !alreadyFlaggedHabitIds.has(h.id)
  );
  if (!missed) return null;

  return {
    triggerType: "habit_missed",
    data: { habitId: missed.id, habitName: missed.name, date: yesterdayIso },
  };
}

// ------------------------------------------------------------
// 4. Goal rimandato (ritmo di avanzamento insufficiente rispetto alla scadenza)
// ------------------------------------------------------------
// Quanto un goal deve essere indietro rispetto al ritmo atteso prima
// di generare un nudge: sotto questa soglia è normale variabilità,
// non serve un commento ogni volta che il progresso non è lineare.
const GOAL_DELAYED_MARGIN_PCT = 15;

export function detectGoalDelayed(
  goal: { id: string; title: string; targetDate: string; createdAtIso: string },
  progressPct: number,
  todayIso: string
): TriggerResult | null {
  const totalDays = daysBetweenIso(goal.createdAtIso.slice(0, 10), goal.targetDate);
  if (totalDays <= 0) return null;
  const elapsedDays = daysBetweenIso(goal.createdAtIso.slice(0, 10), todayIso);
  if (elapsedDays <= 0 || elapsedDays >= totalDays) return null;

  const expectedPct = Math.round((elapsedDays / totalDays) * 100);
  if (expectedPct - progressPct < GOAL_DELAYED_MARGIN_PCT) return null;

  return {
    triggerType: "goal_delayed",
    data: { goalId: goal.id, title: goal.title, progressPct, expectedPct },
  };
}

// ------------------------------------------------------------
// 5. Pasto sopra target (soglia sulle kcal giornaliere)
// ------------------------------------------------------------
const MEAL_OVER_TARGET_THRESHOLD_PCT = 15;
// Nessun nudge nelle prime settimane di utilizzo: senza baseline
// storica un singolo dato genera più ansia che insight (vedi
// addendum 3.1).
const MEAL_OVER_TARGET_MIN_HISTORY_DAYS = 14;

export function detectMealOverTarget(
  todayKcal: number,
  targetKcal: number,
  distinctLoggedDaysHistory: number
): TriggerResult | null {
  if (distinctLoggedDaysHistory < MEAL_OVER_TARGET_MIN_HISTORY_DAYS) return null;
  if (targetKcal <= 0) return null;

  const pctOver = Math.round(((todayKcal - targetKcal) / targetKcal) * 100);
  if (pctOver < MEAL_OVER_TARGET_THRESHOLD_PCT) return null;

  return {
    triggerType: "meal_over_target",
    data: { todayKcal: Math.round(todayKcal), targetKcal: Math.round(targetKcal), pctOver },
  };
}

// ------------------------------------------------------------
// 6. Streak raggiunta (milestone 7/30/90 giorni)
// ------------------------------------------------------------
const STREAK_MILESTONES = [7, 30, 90] as const;

export function detectStreakMilestone(
  habitId: string,
  habitName: string,
  streakDays: number
): TriggerResult | null {
  if (!(STREAK_MILESTONES as readonly number[]).includes(streakDays)) return null;

  return {
    triggerType: "streak_milestone",
    data: { habitId, habitName, streakDays },
  };
}
