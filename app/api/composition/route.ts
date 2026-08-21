// ============================================================
// IterUp — GET /api/composition
// ------------------------------------------------------------
// Aggrega i dati per la Bussola di Ricomposizione Corporea: storico
// check-in con BF%/FM/FFM calcolati (Navy formula), direzione tra gli
// ultimi due check-in, breakdown numerico. Sola lettura — vedi
// PRD-addendum-bussola-ricomposizione.md.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { calculateAge, type ActivityLevel, type Sex } from "@/lib/tdee";
import { requireApiAuth } from "@/lib/api-auth";
import {
  calculateNavyBF,
  calculateFatMass,
  calculateMaintenance,
  calculateEnergyBalance,
  calculateRecompositionIndex,
  calculateEnergyScore,
  determineDirection,
  daysBetween,
  SHORT_INTERVAL_WARNING_DAYS,
} from "@/lib/composition";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const [profileResult, historyResult] = await Promise.all([
    supabaseServer
      .from("profiles")
      .select("sex, birth_date, height_cm, activity_level")
      .eq("id", CURRENT_USER_ID)
      .maybeSingle(),
    supabaseServer
      .from("body_metrics")
      .select("recorded_at, weight_kg, neck_cm, waist_cm, hip_cm, kcal_period, neck_feel, wrist_feel, sex_at_checkin")
      .eq("user_id", CURRENT_USER_ID)
      .order("recorded_at", { ascending: true }),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }
  if (historyResult.error) {
    return NextResponse.json({ error: historyResult.error.message }, { status: 500 });
  }

  const profile = profileResult.data;
  if (!profile?.height_cm || !profile.birth_date || !profile.activity_level) {
    return NextResponse.json({
      hasProfile: false,
      hasEnoughData: false,
      checkins: [],
      latest: null,
    });
  }

  // Solo le righe con i campi obbligatori per il calcolo BF% (vedi
  // addendum sezione 3): peso, collo, vita, e fianchi se il sesso al
  // momento del check-in era femminile.
  const rows = historyResult.data ?? [];
  const checkins = rows
    .map((r) => {
      const sex: Sex = (r.sex_at_checkin as Sex | null) ?? (profile.sex as Sex | null) ?? "m";
      if (r.weight_kg === null || r.neck_cm === null || r.waist_cm === null) return null;
      if (sex === "f" && !r.hip_cm) return null;

      let bfPercent: number;
      try {
        bfPercent = calculateNavyBF({
          sex,
          waistCm: r.waist_cm,
          neckCm: r.neck_cm,
          heightCm: profile.height_cm as number,
          hipCm: r.hip_cm,
        });
      } catch {
        return null;
      }

      const { fm, ffm } = calculateFatMass(r.weight_kg, bfPercent);

      return {
        date: r.recorded_at,
        weightKg: r.weight_kg,
        bfPercent: Math.round(bfPercent * 10) / 10,
        fm: Math.round(fm * 100) / 100,
        ffm: Math.round(ffm * 100) / 100,
        kcalPeriod: r.kcal_period,
        neckFeel: r.neck_feel,
        wristFeel: r.wrist_feel,
        sex,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (checkins.length === 0) {
    return NextResponse.json({ hasProfile: true, hasEnoughData: false, checkins: [], latest: null });
  }
  if (checkins.length === 1) {
    return NextResponse.json({
      hasProfile: true,
      hasEnoughData: false,
      checkins: checkins.map(({ date, weightKg, bfPercent, fm, ffm }) => ({ date, weightKg, bfPercent, fm, ffm })),
      latest: null,
    });
  }

  const current = checkins[checkins.length - 1];
  const previous = checkins[checkins.length - 2];

  const age = calculateAge(profile.birth_date);
  const { tdee } = calculateMaintenance(
    current.sex,
    current.weightKg,
    profile.height_cm as number,
    age,
    profile.activity_level as ActivityLevel
  );

  const days = daysBetween(previous.date, current.date);

  let balance: number | null = null;
  let maintenancePeriod: number | null = null;
  let expectedDeltaWeightKg: number | null = null;
  if (current.kcalPeriod !== null) {
    const eb = calculateEnergyBalance({ tdee, days, kcalPeriod: current.kcalPeriod });
    balance = eb.balance;
    maintenancePeriod = eb.maintenancePeriod;
    expectedDeltaWeightKg = eb.expectedDeltaWeightKg;
  }

  const ir = calculateRecompositionIndex({
    ffmNow: current.ffm,
    ffmPrev: previous.ffm,
    fmNow: current.fm,
    fmPrev: previous.fm,
    neckFeel: current.neckFeel ?? 0,
    wristFeel: current.wristFeel ?? 0,
  });

  const direction = determineDirection({
    compScoreRaw: ir.compScoreRaw,
    balance,
    maintenancePeriod,
    weightNow: current.weightKg,
    weightPrev: previous.weightKg,
  });

  const energyScore = calculateEnergyScore({
    balance,
    maintenancePeriod,
    weightNow: current.weightKg,
    weightPrev: previous.weightKg,
  });

  return NextResponse.json({
    hasProfile: true,
    hasEnoughData: true,
    checkins: checkins.map(({ date, weightKg, bfPercent, fm, ffm }) => ({ date, weightKg, bfPercent, fm, ffm })),
    latest: {
      date: current.date,
      previousDate: previous.date,
      days,
      weightNow: current.weightKg,
      weightPrev: previous.weightKg,
      fmNow: current.fm,
      fmPrev: previous.fm,
      ffmNow: current.ffm,
      ffmPrev: previous.ffm,
      tdee,
      energy: current.kcalPeriod !== null ? { kcalPeriod: current.kcalPeriod, maintenancePeriod, balance, expectedDeltaWeightKg } : null,
      recomposition: ir,
      energyScore,
      direction,
      warnings: {
        shortInterval: days < SHORT_INTERVAL_WARNING_DAYS,
        missingEnergyData: current.kcalPeriod === null,
      },
    },
  });
}
