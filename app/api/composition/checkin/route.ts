// ============================================================
// IterUp — POST /api/composition/checkin
// ------------------------------------------------------------
// Salva un check-in Bussola: peso, collo, vita (sempre richiesti),
// fianchi (richiesto se sesso donna), kcal periodo (opzionale),
// percezione soggettiva collo/polso. Validazione bloccante — vedi
// PRD-addendum-bussola-ricomposizione.md sezione 3 ("replica esatta
// della logica del prototipo, funzione saveEntry").
//
// Scrive su body_metrics (condivisa con /misure) via upsert
// merge-aware, così non cancella i campi scritti dal form Misure per
// lo stesso giorno. Il sesso del profilo AL MOMENTO di questo
// check-in viene salvato come sex_at_checkin (snapshot, vedi
// addendum sezione 7).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { upsertBodyMetricsForDate } from "@/lib/body-metrics-store";
import { WEIGHT_RANGE, CIRCUMFERENCE_RANGE, todayISODate } from "@/app/api/body-metrics/validation";
import { HIP_CM_RANGE, KCAL_PERIOD_RANGE } from "@/lib/composition";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function parseNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

function isFeelValue(v: unknown): v is -1 | 0 | 1 {
  return v === -1 || v === 0 || v === 1;
}

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("sex")
    .eq("id", CURRENT_USER_ID)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile?.sex) {
    return NextResponse.json(
      { error: "Completa il profilo (sesso) in Impostazioni prima del check-in." },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const b = body as Record<string, unknown>;

  const recorded_at = typeof b.recorded_at === "string" && b.recorded_at.trim() ? b.recorded_at.trim() : todayISODate();

  const weight_kg = parseNumber(b.weight_kg);
  if (weight_kg === null) errors.push("Il peso è obbligatorio.");
  else if (weight_kg < WEIGHT_RANGE.min || weight_kg > WEIGHT_RANGE.max) {
    errors.push(`Il peso deve essere tra ${WEIGHT_RANGE.min} e ${WEIGHT_RANGE.max} kg.`);
  }

  const neck_cm = parseNumber(b.neck_cm);
  if (neck_cm === null) errors.push("Il collo è obbligatorio.");
  else if (neck_cm < CIRCUMFERENCE_RANGE.min || neck_cm > CIRCUMFERENCE_RANGE.max) {
    errors.push(`Il collo deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`);
  }

  const waist_cm = parseNumber(b.waist_cm);
  if (waist_cm === null) errors.push("La vita è obbligatoria.");
  else if (waist_cm < CIRCUMFERENCE_RANGE.min || waist_cm > CIRCUMFERENCE_RANGE.max) {
    errors.push(`La vita deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`);
  }

  const hip_cm = parseNumber(b.hip_cm);
  if (profile.sex === "f") {
    if (hip_cm === null) errors.push("I fianchi sono obbligatori (richiesti per il calcolo con sesso donna).");
    else if (hip_cm < HIP_CM_RANGE.min || hip_cm > HIP_CM_RANGE.max) {
      errors.push(`I fianchi devono essere tra ${HIP_CM_RANGE.min} e ${HIP_CM_RANGE.max} cm.`);
    }
  }

  // Indicatori di contesto opzionali: non entrano nel calcolo BF%/IR
  // (vedi addendum sezione 8 "Fuori scope"), ma vengono registrati.
  const chest_cm = parseNumber(b.chest_cm);
  if (chest_cm !== null && (chest_cm < CIRCUMFERENCE_RANGE.min || chest_cm > CIRCUMFERENCE_RANGE.max)) {
    errors.push(`Il petto deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`);
  }
  const thigh_cm = parseNumber(b.thigh_cm);
  if (thigh_cm !== null && (thigh_cm < CIRCUMFERENCE_RANGE.min || thigh_cm > CIRCUMFERENCE_RANGE.max)) {
    errors.push(`La coscia deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`);
  }
  const wrist_cm = parseNumber(b.wrist_cm);
  if (wrist_cm !== null && (wrist_cm < CIRCUMFERENCE_RANGE.min || wrist_cm > CIRCUMFERENCE_RANGE.max)) {
    errors.push(`Il polso deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`);
  }

  const kcal_period = parseNumber(b.kcal_period);
  if (kcal_period !== null && (kcal_period < KCAL_PERIOD_RANGE.min || kcal_period > KCAL_PERIOD_RANGE.max)) {
    errors.push(`Le kcal del periodo devono essere tra ${KCAL_PERIOD_RANGE.min} e ${KCAL_PERIOD_RANGE.max}.`);
  }

  const neck_feel = b.neck_feel !== undefined && b.neck_feel !== null && b.neck_feel !== "" ? Number(b.neck_feel) : null;
  if (neck_feel !== null && !isFeelValue(neck_feel)) {
    errors.push("Valore non valido per la percezione del collo.");
  }
  const wrist_feel = b.wrist_feel !== undefined && b.wrist_feel !== null && b.wrist_feel !== "" ? Number(b.wrist_feel) : null;
  if (wrist_feel !== null && !isFeelValue(wrist_feel)) {
    errors.push("Valore non valido per la percezione del polso.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  // Petto/coscia/polso: se il campo è vuoto in questo check-in, non lo
  // includiamo nel patch (invece di forzarlo a null), così un valore
  // già scritto dal form Misure per lo stesso giorno non viene perso
  // — vedi lib/body-metrics-store.ts.
  const optionalContextFields: Partial<{ chest_cm: number; thigh_cm: number; wrist_cm: number }> = {};
  if (chest_cm !== null) optionalContextFields.chest_cm = chest_cm;
  if (thigh_cm !== null) optionalContextFields.thigh_cm = thigh_cm;
  if (wrist_cm !== null) optionalContextFields.wrist_cm = wrist_cm;

  const { data, error } = await upsertBodyMetricsForDate(CURRENT_USER_ID, recorded_at, {
    weight_kg,
    neck_cm,
    waist_cm,
    hip_cm: profile.sex === "f" ? hip_cm : null,
    ...optionalContextFields,
    kcal_period,
    neck_feel: neck_feel as -1 | 0 | 1 | null,
    wrist_feel: wrist_feel as -1 | 0 | 1 | null,
    sex_at_checkin: profile.sex as "m" | "f",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
