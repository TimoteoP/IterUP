// ============================================================
// IterUp — GET /api/coach/morning
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 4. Pensato per
// essere chiamato da uno Shortcut iOS pianificato (Siri o notifica
// locale), non dal browser — ma espone dati personali (obiettivi,
// abitudini), quindi resta protetto come le altre GET (vedi
// lib/api-auth.ts): il token va aggiunto all'URL configurato nello
// Shortcut.
//
// Risponde SEMPRE con 3 componenti anche se daily_focus è vuoto
// (fallback su goals/habits) — criterio di accettazione
// dell'addendum.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireShortcutAuth } from "@/lib/api-auth";
import { calculateStreak } from "@/lib/streak";
import { generateMorningReflection } from "@/lib/coach-messages";

export const dynamic = "force-dynamic";

const HABIT_HISTORY_WINDOW_DAYS = 30;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authError = requireShortcutAuth(request);
  if (authError) return authError;

  const today = todayIso();
  const historyCutoff = addDaysIso(today, -HABIT_HISTORY_WINDOW_DAYS);

  const [focusResult, goalsResult, habitsResult, habitLogsResult, reflection] = await Promise.all([
    supabaseServer
      .from("daily_focus")
      .select("*")
      .eq("user_id", CURRENT_USER_ID)
      .eq("focus_date", today)
      .maybeSingle(),
    supabaseServer
      .from("goals")
      .select("title, target_date")
      .eq("user_id", CURRENT_USER_ID)
      .eq("status", "in_corso")
      .order("target_date", { ascending: true, nullsFirst: false }),
    supabaseServer.from("habits").select("id, name").eq("user_id", CURRENT_USER_ID).eq("is_active", true),
    supabaseServer
      .from("habit_logs")
      .select("habit_id, recorded_at, completed")
      .eq("user_id", CURRENT_USER_ID)
      .gte("recorded_at", historyCutoff),
    generateMorningReflection().catch(
      () => "Ogni piccolo passo di oggi conta più della perfezione: la costanza si costruisce un giorno alla volta."
    ),
  ]);

  // 1. Priorità: da daily_focus se presente, altrimenti derivate da
  // goal più urgenti + abitudini non ancora completate oggi.
  const focus = focusResult.data;
  let priorities = [focus?.priority_1, focus?.priority_2, focus?.priority_3].filter(
    (p): p is string => typeof p === "string" && p.length > 0
  );

  const habits = habitsResult.data ?? [];
  const habitLogs = habitLogsResult.data ?? [];
  const logsByHabit = new Map<string, Map<string, boolean>>();
  for (const log of habitLogs) {
    if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, new Map());
    logsByHabit.get(log.habit_id)!.set(log.recorded_at, log.completed === true);
  }
  const notCompletedToday = habits.filter((h) => logsByHabit.get(h.id)?.get(today) !== true);

  if (priorities.length === 0) {
    const goalTitles = (goalsResult.data ?? []).slice(0, 2).map((g) => g.title);
    const habitNames = notCompletedToday.slice(0, 3 - goalTitles.length).map((h) => h.name);
    priorities = [...goalTitles, ...habitNames].slice(0, 3);
  }

  // 2. Un'abitudine da ricordare: (a) quella con lo streak più a
  // rischio tra quelle non ancora fatte oggi, (b) altrimenti quella
  // storicamente meno completata (proxy di "a rischio di salto" in
  // assenza di uno streak attivo da proteggere).
  let habitReminder: { habitId: string; habitName: string; streakDays: number } | null = null;
  if (notCompletedToday.length > 0) {
    const withStreak = notCompletedToday.map((h) => ({
      habit: h,
      streak: calculateStreak(logsByHabit.get(h.id) ?? new Map(), addDaysIso(today, -1)),
    }));
    withStreak.sort((a, b) => b.streak - a.streak);

    if (withStreak[0].streak > 0) {
      habitReminder = { habitId: withStreak[0].habit.id, habitName: withStreak[0].habit.name, streakDays: withStreak[0].streak };
    } else {
      const withRate = notCompletedToday.map((h) => {
        const log = logsByHabit.get(h.id) ?? new Map();
        const completedCount = Array.from(log.values()).filter(Boolean).length;
        const rate = log.size > 0 ? completedCount / log.size : 0;
        return { habit: h, rate };
      });
      withRate.sort((a, b) => a.rate - b.rate);
      habitReminder = { habitId: withRate[0].habit.id, habitName: withRate[0].habit.name, streakDays: 0 };
    }
  }

  return NextResponse.json({
    date: today,
    reflection,
    priorities,
    habitReminder,
  });
}
