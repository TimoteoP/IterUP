// ============================================================
// IterUp — Webhook di ingestione attività (A6)
// ------------------------------------------------------------
// Endpoint pensato per essere chiamato da uno Shortcut iOS (es.
// automazione "fine giornata" che legge i passi da Salute, oppure
// automazione dopo un allenamento) — POST con un body JSON.
//
// AUTENTICAZIONE — shared secret, DA AGGIUNGERE a .env.local:
//   ACTIVITY_WEBHOOK_SECRET=<stringa-casuale-lunga>
// Lo Shortcut deve passare questo valore come header `x-webhook-token`
// oppure come query param `?token=...` (gli Shortcuts iOS a volte
// gestiscono male gli header custom, quindi supportiamo entrambi).
// Se la env var manca o il token non combacia -> 401.
//
// Body atteso (tutti i campi opzionali, ma almeno uno deve essere
// presente):
//   {
//     "steps"?: number,
//     "workout_type"?: string,        // es. "corsa", "palestra"
//     "workout_minutes"?: number,
//     "calories_burned"?: number,
//     "recorded_at"?: "YYYY-MM-DD",   // default: oggi
//     "source"?: string               // default: "shortcuts"
//   }
//
// Logica anti-duplicati (vedi nota schema nel prompt):
// - Se workout_type è presente: la unique (user_id, recorded_at,
//   workout_type) è valorizzata su tutte e 3 le colonne -> upsert reale
//   con onConflict.
// - Se workout_type è assente (caso "solo passi giornalieri"): NULL non
//   è mai uguale a NULL in un vincolo unique in Postgres, quindi un
//   upsert con onConflict su quelle colonne NON intercetterebbe righe
//   esistenti con workout_type null. Facciamo quindi una select
//   esplicita (workout_type IS NULL) e poi UPDATE o INSERT.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { todayISODate, errorResponse, isFiniteNumber, type ActivityPayload } from "../_utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.ACTIVITY_WEBHOOK_SECRET;
  const headerToken = request.headers.get("x-webhook-token");
  const queryToken = request.nextUrl.searchParams.get("token");
  const providedToken = headerToken ?? queryToken;

  if (!secret || !providedToken || providedToken !== secret) {
    return errorResponse("unauthorized", 401);
  }

  let body: ActivityPayload;
  try {
    body = await request.json();
  } catch {
    return errorResponse("body JSON non valido", 400);
  }

  const recordedAt = body.recorded_at ?? todayISODate();
  const workoutType = body.workout_type?.trim() || null;
  const hasSteps = isFiniteNumber(body.steps);
  const hasWorkoutMinutes = isFiniteNumber(body.workout_minutes);
  const hasCalories = isFiniteNumber(body.calories_burned);
  const source = body.source ?? "shortcuts";

  if (!hasSteps && !workoutType && !hasWorkoutMinutes && !hasCalories) {
    return errorResponse(
      "payload vuoto: fornisci almeno steps oppure workout_type",
      400
    );
  }

  // --- Caso 1: allenamento con tipo -> upsert reale sulla unique constraint ---
  if (workoutType) {
    const { data, error } = await supabaseServer
      .from("activity_logs")
      .upsert(
        {
          user_id: CURRENT_USER_ID,
          recorded_at: recordedAt,
          workout_type: workoutType,
          workout_minutes: hasWorkoutMinutes ? body.workout_minutes! : null,
          calories_burned: hasCalories ? body.calories_burned! : null,
          steps: hasSteps ? body.steps! : null,
          source,
        },
        { onConflict: "user_id,recorded_at,workout_type" }
      )
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }
    return NextResponse.json({ data }, { status: 200 });
  }

  // --- Caso 2: solo passi (workout_type null) -> select esplicita + update/insert ---
  const { data: existing, error: findError } = await supabaseServer
    .from("activity_logs")
    .select("id")
    .eq("user_id", CURRENT_USER_ID)
    .eq("recorded_at", recordedAt)
    .is("workout_type", null)
    .maybeSingle();

  if (findError) {
    return errorResponse(findError.message, 500);
  }

  if (existing) {
    const { data, error } = await supabaseServer
      .from("activity_logs")
      .update({
        steps: hasSteps ? body.steps! : undefined,
        calories_burned: hasCalories ? body.calories_burned! : undefined,
        source,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }
    return NextResponse.json({ data }, { status: 200 });
  }

  const { data, error } = await supabaseServer
    .from("activity_logs")
    .insert({
      user_id: CURRENT_USER_ID,
      recorded_at: recordedAt,
      steps: hasSteps ? body.steps! : null,
      calories_burned: hasCalories ? body.calories_burned! : null,
      workout_type: null,
      source,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }
  return NextResponse.json({ data }, { status: 201 });
}
