// ============================================================
// IterUp — API obiettivi (CRUD)
// ------------------------------------------------------------
// GET  /api/goals            -> lista obiettivi dell'utente, con
//       current_value/progress_pct calcolati a runtime dai dati
//       reali (mai salvati, vedi
//       PRD-addendum-hardening-completamento.md A6):
//       - weight: peso attuale vs baseline (primo peso mai
//         registrato) e target_value.
//       - activity: giorni (da quando il goal è stato creato) in cui
//         i passi giornalieri hanno raggiunto target_value.
//       - habit_streak: streak corrente dell'abitudine il cui nome è
//         contenuto nel titolo del goal (best-effort: goals non ha
//         un habit_id, non possiamo linkarli in modo univoco senza
//         modificare lo schema, cosa che questo addendum esclude
//         esplicitamente — se il titolo non contiene in modo
//         inequivocabile il nome di un'unica abitudine attiva,
//         current_value resta null).
//       - custom: nessun calcolo automatico possibile, resta null.
//       ?status=in_corso|raggiunto|abbandonato -> filtro opzionale
// POST /api/goals            -> crea un nuovo obiettivo
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { Tables, TablesInsert } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";
import { enrichGoalsWithProgress } from "@/lib/goal-progress";
import { requireApiAuth } from "@/lib/api-auth";
import { evaluateGoalDelayed } from "@/lib/coach-evaluators";

export const dynamic = "force-dynamic";

const GOAL_TYPES = ["weight", "habit_streak", "activity", "custom"] as const;
const STATUSES = ["in_corso", "raggiunto", "abbandonato"] as const;
type GoalStatus = (typeof STATUSES)[number];

function isGoalStatus(value: string): value is GoalStatus {
  return (STATUSES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const status = request.nextUrl.searchParams.get("status");

  let query = supabaseServer.from("goals")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: false });

  if (status && isGoalStatus(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const goals = await enrichGoalsWithProgress((data ?? []) as Tables<"goals">[]);

  // Coach comportamentale: "valutazione periodica su goals" (vedi
  // PRD-addendum-coach-comportamentale.md sezione 3) — questo GET è
  // il punto periodico naturale, dato che la pagina Obiettivi lo
  // richiama ad ogni apertura. Best-effort, mai bloccante.
  let coachNudge = null;
  try {
    for (const goal of goals) {
      coachNudge = await evaluateGoalDelayed(goal, goal.progress_pct);
      if (coachNudge) break;
    }
  } catch {
    coachNudge = null;
  }

  return NextResponse.json({ goals, ...(coachNudge ? { coachNudge } : {}) });
}

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);

  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json(
      { error: "Il campo 'title' è obbligatorio." },
      { status: 400 }
    );
  }

  if (!(GOAL_TYPES as readonly string[]).includes(body.goal_type)) {
    return NextResponse.json(
      {
        error:
          "Il campo 'goal_type' deve essere uno tra: weight, habit_streak, activity, custom.",
      },
      { status: 400 }
    );
  }

  const payload: TablesInsert<"goals"> = {
    user_id: CURRENT_USER_ID,
    goal_type: body.goal_type,
    title: body.title.trim(),
    target_value:
      body.target_value !== undefined &&
      body.target_value !== null &&
      body.target_value !== ""
        ? Number(body.target_value)
        : null,
    target_date: body.target_date ? String(body.target_date) : null,
    status: "in_corso",
  };

  const { data, error } = await supabaseServer.from("goals")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data as Tables<"goals"> }, { status: 201 });
}
