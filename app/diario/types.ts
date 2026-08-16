// ============================================================
// IterUp — tipi locali al modulo Diario Alimentare (app/diario/*)
// ------------------------------------------------------------
// Non tocca i contratti congelati (/lib/types.ts): sono solo forme
// di risposta usate tra le API route di questo modulo e la UI.
// MEAL_TYPES/DIET_MODES vivono in /lib/nutrition-options.ts (unica
// fonte, vedi PRD-addendum-onboarding-form.md sezione 6).
// ============================================================

import { MEAL_TYPES as ALL_MEAL_TYPES } from "@/lib/nutrition-options";
import type { MealType, DietMode } from "@/lib/nutrition-options";

export type { MealType };
export { isMealType } from "@/lib/nutrition-options";
export const MEAL_TYPES: readonly MealType[] = ALL_MEAL_TYPES.map((m) => m.value);

export const MEAL_LABELS: Record<MealType, string> = {
  colazione: "Colazione",
  pranzo: "Pranzo",
  cena: "Cena",
  spuntino: "Spuntino",
  digiuno: "Digiuno",
  integrazione: "Integrazione",
};

export type FoodResult = {
  id: string;
  name: string;
  category: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
};

export type LogWithMacros = {
  id: string;
  food_id: string | null;
  food_name: string | null;
  quantity_g: number | null;
  meal_type: MealType;
  logged_at: string;
  created_at: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
};

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type ActiveTarget = {
  daily_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mode: DietMode;
};

export type LogsSummary = {
  date: string;
  consumed: MacroTotals;
  target: ActiveTarget | null;
  remaining: MacroTotals | null;
};
