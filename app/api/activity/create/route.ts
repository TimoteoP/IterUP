// ============================================================
// IterUp — Registrazione manuale allenamento (A6)
// ------------------------------------------------------------
// Usata dal form in /app/attivita. workout_type è obbligatorio (è la
// terza colonna della unique constraint insieme a user_id/recorded_at),
// workout_minutes e calories_burned sono opzionali.
// Upsert reale possibile perché workout_type è sempre valorizzato qui.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { todayISODate, errorResponse, isFiniteNumber, type ActivityPayload } from "../_utils";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  let body: ActivityPayload;
  try {
    body = await request.json();
  } catch {
    return errorResponse("body JSON non valido", 400);
  }

  const workoutType = body.workout_type?.trim();
  if (!workoutType) {
    return errorResponse("workout_type è obbligatorio", 400);
  }

  const recordedAt = body.recorded_at ?? todayISODate();
  const hasWorkoutMinutes = isFiniteNumber(body.workout_minutes);
  const hasCalories = isFiniteNumber(body.calories_burned);

  const { data, error } = await supabaseServer
    .from("activity_logs")
    .upsert(
      {
        user_id: CURRENT_USER_ID,
        recorded_at: recordedAt,
        workout_type: workoutType,
        workout_minutes: hasWorkoutMinutes ? body.workout_minutes! : null,
        calories_burned: hasCalories ? body.calories_burned! : null,
        source: "manual",
      },
      { onConflict: "user_id,recorded_at,workout_type" }
    )
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }
  return NextResponse.json({ data }, { status: 201 });
}
