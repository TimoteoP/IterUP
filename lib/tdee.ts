// ============================================================
// IterUp — calcolo TDEE e target macro (modulo Onboarding, A1)
// ------------------------------------------------------------
// Funzioni pure, nessun side-effect / accesso DB.
//
// BMR: formula di Mifflin-St Jeor (1990).
//   Uomini: BMR = 10*peso_kg + 6,25*altezza_cm - 5*età + 5
//   Donne:  BMR = 10*peso_kg + 6,25*altezza_cm - 5*età - 161
//
// TDEE = BMR * moltiplicatore di attività (vedi ACTIVITY_MULTIPLIERS):
//   sedentario ×1,2 · lievemente attivo ×1,375 · moderatamente
//   attivo ×1,55 · molto attivo ×1,725 · estremamente attivo ×1,9
//
// Le kcal target derivano da TDEE + aggiustamento per obiettivo
// (dimagrimento/mantenimento/costruzione muscolare/recupero, vedi
// MODE_KCAL_ADJUSTMENT). La DIVISIONE di quelle kcal in
// carbo/proteine/grassi dipende invece dal regime alimentare scelto
// (mediterraneo, keto, ecc. — vedi macroSplitForRegime in
// lib/nutrition-options.ts): due assi indipendenti, "quante kcal" e
// "come si dividono".
//
// In futuro è previsto affiancare a Mifflin-St Jeor altre formule di
// calcolo del dispendio calorico (es. Harris-Benedict) selezionabili
// dall'utente — non ancora implementato, fuori scope di questa fase.
// ============================================================

import { macroSplitForRegime, type DietMode, type DietaryRegime } from "./nutrition-options";

export type Sex = "m" | "f";

export type ActivityLevel =
  | "sedentario"
  | "leggero"
  | "moderato"
  | "attivo"
  | "molto_attivo";

export type GoalMode = DietMode;

export interface TDEEInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  mode: GoalMode;
  dietaryRegime: DietaryRegime;
}

export interface TDEEResult {
  /** Basal Metabolic Rate, kcal/giorno — dispendio a riposo. */
  bmr: number;
  /** Total Daily Energy Expenditure a mantenimento, kcal/giorno (BMR * attività). */
  tdee: number;
  /** Target calorico giornaliero per l'obiettivo scelto (tdee + MODE_KCAL_ADJUSTMENT). */
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Moltiplicatori di attività standard (Mifflin-St Jeor, dal BMR al TDEE).
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentario: 1.2, // lavoro d'ufficio, nessun allenamento
  leggero: 1.375, // lievemente attivo: esercizio leggero 1-3 volte/settimana
  moderato: 1.55, // moderatamente attivo: esercizio moderato 3-5 volte/settimana
  attivo: 1.725, // molto attivo: allenamento intenso 6-7 volte/settimana
  molto_attivo: 1.9, // estremamente attivo: lavoro fisico pesante o doppi allenamenti
};

// Aggiustamento percentuale sul TDEE in base al tipo di dieta.
// dimagrimento: deficit -20% (ragionevole, sostenibile)
// mantenimento: nessun aggiustamento
// costruzione_muscolare: surplus +12.5% (nel range consigliato 10-15%)
// recupero: leggero surplus +5%, per favorire il recupero senza
//   accumulo di grasso eccessivo (es. dopo un periodo di deficit/infortunio)
export const MODE_KCAL_ADJUSTMENT: Record<GoalMode, number> = {
  dimagrimento: -0.2,
  mantenimento: 0,
  costruzione_muscolare: 0.125,
  recupero: 0.05,
};

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

/**
 * Calcola BMR (Mifflin-St Jeor), TDEE e target macro. Le kcal target
 * derivano da tdee + MODE_KCAL_ADJUSTMENT[mode]; i grammi di
 * carbo/proteine/grassi derivano da quelle kcal applicando lo split
 * percentuale del regime alimentare (macroSplitForRegime). Pura:
 * nessun accesso a DB/rete, facilmente testabile.
 */
export function calculateTDEE(input: TDEEInput): TDEEResult {
  const { sex, weightKg, heightCm, age, activityLevel, mode, dietaryRegime } = input;

  const sexOffset = sex === "m" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  const dailyKcal = Math.round(tdee * (1 + MODE_KCAL_ADJUSTMENT[mode]));

  const split = macroSplitForRegime(dietaryRegime);
  const proteinG = Math.round((dailyKcal * (split.proteinPct / 100)) / KCAL_PER_G_PROTEIN);
  const fatG = Math.round((dailyKcal * (split.fatPct / 100)) / KCAL_PER_G_FAT);
  const carbsG = Math.round((dailyKcal * (split.carbPct / 100)) / KCAL_PER_G_CARBS);

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
  { value: "sedentario", label: "Sedentario (lavoro d'ufficio, nessun allenamento)" },
  { value: "leggero", label: "Lievemente attivo (esercizio leggero 1-3 volte/settimana)" },
  { value: "moderato", label: "Moderatamente attivo (esercizio moderato 3-5 volte/settimana)" },
  { value: "attivo", label: "Molto attivo (allenamento intenso 6-7 volte/settimana)" },
  { value: "molto_attivo", label: "Estremamente attivo (lavoro fisico pesante o doppi allenamenti)" },
];

// Le opzioni del tipo di dieta vivono in un unico posto:
// vedi DIET_MODES in lib/nutrition-options.ts.
