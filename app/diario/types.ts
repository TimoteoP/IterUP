// ============================================================
// IterUp — tipi locali al modulo Diario Alimentare (app/diario/*)
// ------------------------------------------------------------
// Non tocca i contratti congelati (/lib/types.ts): sono solo forme
// di risposta usate tra le API route di questo modulo e la UI.
// ============================================================

export const MEAL_TYPES = ["colazione", "pranzo", "cena", "spuntino"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  colazione: "Colazione",
  pranzo: "Pranzo",
  cena: "Cena",
  spuntino: "Spuntino",
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
  food_id: string;
  food_name: string;
  quantity_g: number;
  meal_type: MealType;
  logged_at: string;
  created_at: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
  mode: "loss" | "maintain" | "gain";
};

export type LogsSummary = {
  date: string;
  consumed: MacroTotals;
  target: ActiveTarget | null;
  remaining: MacroTotals | null;
};
