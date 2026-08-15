// ============================================================
// IterUp — calcolo TDEE e target macro (modulo Onboarding, A1)
// ------------------------------------------------------------
// Funzioni pure, nessun side-effect / accesso DB. Formula di
// Mifflin-St Jeor per il BMR, moltiplicatori di attività per il
// TDEE, poi split macro in base all'obiettivo (mode).
// ============================================================

export type Sex = "m" | "f";

export type ActivityLevel =
  | "sedentario"
  | "leggero"
  | "moderato"
  | "attivo"
  | "molto_attivo";

export type GoalMode = "loss" | "maintain" | "gain";

export interface TDEEInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  mode: GoalMode;
}

export interface TDEEResult {
  /** Basal Metabolic Rate, kcal/giorno */
  bmr: number;
  /** Total Daily Energy Expenditure a mantenimento, kcal/giorno */
  tdee: number;
  /** Target calorico giornaliero in base al mode scelto */
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Moltiplicatori di attività (Harris-Benedict / Mifflin standard).
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentario: 1.2, // poco o nessun esercizio
  leggero: 1.375, // esercizio leggero 1-3 giorni/settimana
  moderato: 1.55, // esercizio moderato 3-5 giorni/settimana
  attivo: 1.725, // esercizio intenso 6-7 giorni/settimana
  molto_attivo: 1.9, // esercizio molto intenso + lavoro fisico
};

// Aggiustamento percentuale sul TDEE in base all'obiettivo.
// loss: deficit -20% (ragionevole, sostenibile)
// maintain: nessun aggiustamento
// gain: surplus +12.5% (nel range consigliato 10-15%)
export const MODE_KCAL_ADJUSTMENT: Record<GoalMode, number> = {
  loss: -0.2,
  maintain: 0,
  gain: 0.125,
};

// Proteine g/kg di peso corporeo. Più alte in deficit per
// preservare la massa magra, leggermente più basse in surplus.
export const PROTEIN_G_PER_KG: Record<GoalMode, number> = {
  loss: 2.2,
  maintain: 2.0,
  gain: 1.8,
};

// Quota di kcal giornaliere da grassi (25-30% consigliato, usiamo 28%).
export const FAT_KCAL_FRACTION = 0.28;

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

/**
 * Calcola BMR (Mifflin-St Jeor), TDEE e target macro in base al
 * mode scelto. Pura: nessun accesso a DB/rete, facilmente testabile.
 */
export function calculateTDEE(input: TDEEInput): TDEEResult {
  const { sex, weightKg, heightCm, age, activityLevel, mode } = input;

  const sexOffset = sex === "m" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  const dailyKcal = Math.round(tdee * (1 + MODE_KCAL_ADJUSTMENT[mode]));

  const proteinG = Math.round(PROTEIN_G_PER_KG[mode] * weightKg);
  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;

  const fatKcal = dailyKcal * FAT_KCAL_FRACTION;
  const fatG = Math.round(fatKcal / KCAL_PER_G_FAT);

  const remainingKcal = Math.max(dailyKcal - proteinKcal - fatG * KCAL_PER_G_FAT, 0);
  const carbsG = Math.round(remainingKcal / KCAL_PER_G_CARBS);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyKcal,
    proteinG,
    carbsG,
    fatG,
  };
}

/** Calcola l'età in anni compiuti da una data di nascita (YYYY-MM-DD) rispetto ad oggi. */
export function calculateAge(birthDateISO: string, today: Date = new Date()): number {
  const birth = new Date(birthDateISO);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

// Range fisici validi, condivisi tra form client e validazione server.
export const HEIGHT_CM_RANGE = { min: 100, max: 250 } as const;
export const WEIGHT_KG_RANGE = { min: 30, max: 300 } as const;
export const AGE_YEARS_RANGE = { min: 10, max: 100 } as const;

export const ACTIVITY_LEVEL_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentario", label: "Sedentario (poco o nessun esercizio)" },
  { value: "leggero", label: "Leggero (esercizio 1-3 giorni/settimana)" },
  { value: "moderato", label: "Moderato (esercizio 3-5 giorni/settimana)" },
  { value: "attivo", label: "Attivo (esercizio intenso 6-7 giorni/settimana)" },
  { value: "molto_attivo", label: "Molto attivo (esercizio intenso + lavoro fisico)" },
];

export const GOAL_MODE_OPTIONS: { value: GoalMode; label: string }[] = [
  { value: "loss", label: "Dimagrire" },
  { value: "maintain", label: "Mantenere" },
  { value: "gain", label: "Aumentare massa" },
];
