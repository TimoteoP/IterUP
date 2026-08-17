// ============================================================
// IterUp — /api/profile
// ------------------------------------------------------------
// GET  -> profilo corrente + peso più recente + target attivo, per
//         precompilare il form in /impostazioni (usato sia al primo
//         avvio, form vuoto, sia per la modifica successiva — non è
//         un one-shot immutabile, vedi
//         PRD-addendum-onboarding-form.md sezione 1).
// POST -> upsert profiles, upsert body_metrics (peso di oggi),
//         calcola TDEE/target con lib/tdee.ts, disattiva il target
//         precedente e inserisce il nuovo user_targets attivo.
// ============================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import {
  calculateTDEE,
  calculateAge,
  HEIGHT_CM_RANGE,
  WEIGHT_KG_RANGE,
  AGE_YEARS_RANGE,
  type Sex,
  type ActivityLevel,
  type GoalMode,
} from "@/lib/tdee";
import { isDietMode, isDietaryRegime, type DietaryRegime } from "@/lib/nutrition-options";

export const dynamic = "force-dynamic";

export async function GET() {
  const [profileResult, weightResult, targetResult] = await Promise.all([
    supabaseServer.from("profiles").select("*").eq("id", CURRENT_USER_ID).maybeSingle(),
    supabaseServer
      .from("body_metrics")
      .select("weight_kg, recorded_at")
      .eq("user_id", CURRENT_USER_ID)
      .not("weight_kg", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("user_targets")
      .select("mode")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: profileResult.data,
    latestWeightKg: weightResult.data?.weight_kg ?? null,
    activeMode: targetResult.data?.mode ?? null,
  });
}

const VALID_SEXES: Sex[] = ["m", "f"];
const VALID_ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentario",
  "leggero",
  "moderato",
  "attivo",
  "molto_attivo",
];

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function cleanStringList(v: string[]): string[] {
  return v.map((s) => s.trim()).filter(Boolean);
}

interface ProfilePayload {
  fullName: string;
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  mode: GoalMode;
  dietaryRegime: DietaryRegime;
  allergies: string[];
  preferences: string[];
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validatePayload(body: unknown): { data: ProfilePayload } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Payload mancante o non valido." };
  }
  const b = body as Record<string, unknown>;

  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  if (!fullName) {
    return { error: "Il nome è obbligatorio." };
  }

  if (typeof b.sex !== "string" || !VALID_SEXES.includes(b.sex as Sex)) {
    return { error: "Sesso non valido (atteso 'm' o 'f')." };
  }
  const sex = b.sex as Sex;

  if (typeof b.birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)) {
    return { error: "Data di nascita non valida." };
  }
  const birthDate = b.birthDate;
  const birthDateObj = new Date(birthDate);
  if (Number.isNaN(birthDateObj.getTime()) || birthDateObj > new Date()) {
    return { error: "Data di nascita non valida." };
  }
  const age = calculateAge(birthDate);
  if (age < AGE_YEARS_RANGE.min || age > AGE_YEARS_RANGE.max) {
    return {
      error: `Età fuori range (${AGE_YEARS_RANGE.min}-${AGE_YEARS_RANGE.max} anni).`,
    };
  }

  if (!isFiniteNumber(b.heightCm) || b.heightCm < HEIGHT_CM_RANGE.min || b.heightCm > HEIGHT_CM_RANGE.max) {
    return {
      error: `Altezza fuori range (${HEIGHT_CM_RANGE.min}-${HEIGHT_CM_RANGE.max} cm).`,
    };
  }
  const heightCm = b.heightCm;

  if (!isFiniteNumber(b.weightKg) || b.weightKg < WEIGHT_KG_RANGE.min || b.weightKg > WEIGHT_KG_RANGE.max) {
    return {
      error: `Peso fuori range (${WEIGHT_KG_RANGE.min}-${WEIGHT_KG_RANGE.max} kg).`,
    };
  }
  const weightKg = b.weightKg;

  if (typeof b.activityLevel !== "string" || !VALID_ACTIVITY_LEVELS.includes(b.activityLevel as ActivityLevel)) {
    return { error: "Livello di attività non valido." };
  }
  const activityLevel = b.activityLevel as ActivityLevel;

  if (!isDietMode(b.mode)) {
    return { error: "Tipo di dieta non valido." };
  }
  const mode = b.mode;

  if (!isDietaryRegime(b.dietaryRegime)) {
    return { error: "Regime alimentare non valido." };
  }
  const dietaryRegime = b.dietaryRegime;

  const allergies = isStringArray(b.allergies) ? cleanStringList(b.allergies) : [];
  const preferences = isStringArray(b.preferences) ? cleanStringList(b.preferences) : [];

  return {
    data: {
      fullName,
      sex,
      birthDate,
      heightCm,
      weightKg,
      activityLevel,
      mode,
      dietaryRegime,
      allergies,
      preferences,
    },
  };
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido nel body della richiesta." }, { status: 400 });
  }

  const validation = validatePayload(rawBody);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const {
    fullName,
    sex,
    birthDate,
    heightCm,
    weightKg,
    activityLevel,
    mode,
    dietaryRegime,
    allergies,
    preferences,
  } = validation.data;

  const today = new Date().toISOString().slice(0, 10);
  const age = calculateAge(birthDate);

  // 1. upsert profiles
  const { error: profileError } = await supabaseServer
    .from("profiles")
    .upsert(
      {
        id: CURRENT_USER_ID,
        full_name: fullName,
        sex,
        birth_date: birthDate,
        height_cm: heightCm,
        activity_level: activityLevel,
        dietary_regime: dietaryRegime,
        allergies,
        preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return NextResponse.json(
      { error: `Errore salvataggio profilo: ${profileError.message}` },
      { status: 500 }
    );
  }

  // 2. upsert body_metrics per la data odierna (vincolo unique(user_id, recorded_at))
  const { error: bodyMetricsError } = await supabaseServer
    .from("body_metrics")
    .upsert(
      {
        user_id: CURRENT_USER_ID,
        recorded_at: today,
        weight_kg: weightKg,
      },
      { onConflict: "user_id,recorded_at" }
    );

  if (bodyMetricsError) {
    return NextResponse.json(
      { error: `Errore salvataggio peso: ${bodyMetricsError.message}` },
      { status: 500 }
    );
  }

  // 3. calcola TDEE e target macro (lo split carbo/proteine/grassi
  // dipende dal regime alimentare, vedi lib/nutrition-options.ts)
  const tdeeResult = calculateTDEE({
    sex,
    weightKg,
    heightCm,
    age,
    activityLevel,
    mode,
    dietaryRegime,
  });

  // 4. disattiva i target precedenti, poi inserisce il nuovo target attivo
  const { error: deactivateError } = await supabaseServer
    .from("user_targets")
    .update({ is_active: false })
    .eq("user_id", CURRENT_USER_ID)
    .eq("is_active", true);

  if (deactivateError) {
    return NextResponse.json(
      { error: `Errore aggiornamento target precedenti: ${deactivateError.message}` },
      { status: 500 }
    );
  }

  const { data: newTarget, error: insertTargetError } = await supabaseServer
    .from("user_targets")
    .insert({
      user_id: CURRENT_USER_ID,
      mode,
      daily_kcal: tdeeResult.dailyKcal,
      protein_g: tdeeResult.proteinG,
      carbs_g: tdeeResult.carbsG,
      fat_g: tdeeResult.fatG,
      is_active: true,
    })
    .select()
    .single();

  if (insertTargetError) {
    return NextResponse.json(
      { error: `Errore salvataggio target: ${insertTargetError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    tdee: tdeeResult,
    target: newTarget,
  });
}
