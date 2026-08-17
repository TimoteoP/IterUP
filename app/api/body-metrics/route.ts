// ============================================================
// IterUp — API route: Misure corporee (body_metrics)
// ------------------------------------------------------------
// GET  → storico misurazioni dell'utente corrente, più recenti prima
// POST → crea/aggiorna una misurazione per una data (upsert su
//        unique(user_id, recorded_at): niente errore di duplicato
//        se si inserisce due volte lo stesso giorno, l'ultimo
//        inserimento vince).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { upsertBodyMetricsForDate } from "@/lib/body-metrics-store";
import { validateBodyMetricsPayload, type BodyMetricsPayload } from "./validation";

// Evita che Next metta in cache le risposte fetch di supabase-js: lo
// storico deve riflettere sempre l'ultimo stato dopo un upsert/delete.
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("body_metrics")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("recorded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: BodyMetricsPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo della richiesta non valido (JSON atteso)." },
      { status: 400 }
    );
  }

  const { errors, recorded_at, weight_kg, neck_cm, chest_cm, waist_cm, thigh_cm } =
    validateBodyMetricsPayload(body);

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  // Merge-aware: non tocca hip_cm/kcal_period/neck_feel/wrist_feel
  // eventualmente scritti dal check-in Bussola per lo stesso giorno.
  const { data, error } = await upsertBodyMetricsForDate(CURRENT_USER_ID, recorded_at, {
    weight_kg,
    neck_cm,
    chest_cm,
    waist_cm,
    thigh_cm,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
