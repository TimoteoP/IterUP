// ============================================================
// IterUp — API log giornaliero abitudini
// ------------------------------------------------------------
// GET  /api/habits/log?date=YYYY-MM-DD   -> log del giorno (default oggi)
// POST /api/habits/log                    -> upsert log di un'abitudine
//      body: { habit_id, recorded_at?, completed?, value? }
//      Rispetta unique(habit_id, recorded_at): un solo log/giorno,
//      upsert su conflitto invece di un secondo insert.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { Tables } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/api-auth";
import { evaluateAfterHabitLogWrite } from "@/lib/coach-evaluators";

export const dynamic = "force-dynamic";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const date = request.nextUrl.searchParams.get("date") ?? todayISODate();

  const { data, error } = await supabaseServer.from("habit_logs")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .eq("recorded_at", date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data as Tables<"habit_logs">[] });
}

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);

  if (!body || typeof body.habit_id !== "string") {
    return NextResponse.json(
      { error: "Il campo 'habit_id' è obbligatorio." },
      { status: 400 }
    );
  }

  const recordedAt: string =
    typeof body.recorded_at === "string" && body.recorded_at
      ? body.recorded_at
      : todayISODate();

  // Verifica che l'abitudine appartenga all'utente corrente e
  // recupera type/target_value per derivare 'completed' se sensato.
  const { data: habitData, error: habitError } = await supabaseServer.from("habits")
    .select("id, name, type, target_value")
    .eq("id", body.habit_id)
    .eq("user_id", CURRENT_USER_ID)
    .single();

  if (habitError || !habitData) {
    return NextResponse.json({ error: "Abitudine non trovata." }, { status: 404 });
  }

  const habit = habitData as Pick<Tables<"habits">, "id" | "name" | "type" | "target_value">;

  let completed: boolean | null = null;
  let value: number | null = null;

  if (habit.type === "boolean") {
    completed = typeof body.completed === "boolean" ? body.completed : null;
  } else {
    value =
      body.value === undefined || body.value === null || body.value === ""
        ? null
        : Number(body.value);

    if (typeof body.completed === "boolean") {
      completed = body.completed;
    } else if (habit.target_value !== null && value !== null) {
      completed = value >= habit.target_value;
    }
  }

  const { data, error } = await supabaseServer.from("habit_logs")
    .upsert(
      {
        habit_id: habit.id,
        user_id: CURRENT_USER_ID,
        recorded_at: recordedAt,
        completed,
        value,
      },
      { onConflict: "habit_id,recorded_at" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const savedLog = data as Tables<"habit_logs">;
  const coachNudge = await evaluateAfterHabitLogWrite(habit.id, habit.name, savedLog.completed, savedLog.recorded_at).catch(
    () => null
  );

  return NextResponse.json({ log: savedLog, ...(coachNudge ? { coachNudge } : {}) });
}
