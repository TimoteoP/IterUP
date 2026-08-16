// ============================================================
// IterUp — liste aperte condivise (tipo di dieta, regime alimentare,
// tipo di pasto)
// ------------------------------------------------------------
// Fonte unica per questi valori: aggiungere una nuova opzione qui
// (e nel relativo CHECK constraint in schema.sql /
// schema-migration-*.sql) è sufficiente, non serve toccare altro
// codice. Vedi PRD-addendum-onboarding-form.md sezione 2.2 e la nota
// del supervisore in schema.sql su user_targets.mode.
// ============================================================

export const DIET_MODES = [
  { value: "dimagrimento", label: "Dimagrimento" },
  { value: "mantenimento", label: "Mantenimento" },
  { value: "costruzione_muscolare", label: "Costruzione muscolare" },
  { value: "recupero", label: "Recupero" },
] as const;

export type DietMode = (typeof DIET_MODES)[number]["value"];

export const DIETARY_REGIMES = [
  { value: "mediterraneo", label: "Mediterraneo" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "high_carb", label: "High-carb" },
] as const;

export type DietaryRegime = (typeof DIETARY_REGIMES)[number]["value"];

export const MEAL_TYPES = [
  { value: "colazione", label: "Colazione" },
  { value: "pranzo", label: "Pranzo" },
  { value: "cena", label: "Cena" },
  { value: "spuntino", label: "Spuntino" },
  { value: "digiuno", label: "Digiuno" },
  { value: "integrazione", label: "Integrazione" },
] as const;

export type MealType = (typeof MEAL_TYPES)[number]["value"];

// Tipi di pasto che non hanno un alimento/quantità associati (vedi
// PRD-addendum-onboarding-form.md sezione 3): 'digiuno' è un log
// diretto senza macro, 'integrazione' logga l'assunzione di
// integratori (non alimenti di /lib/types.ts foods).
export const MEAL_TYPES_WITHOUT_FOOD: readonly MealType[] = ["digiuno", "integrazione"];

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && MEAL_TYPES.some((m) => m.value === value);
}

export function isDietMode(value: unknown): value is DietMode {
  return typeof value === "string" && DIET_MODES.some((m) => m.value === value);
}

export function isDietaryRegime(value: unknown): value is DietaryRegime {
  return typeof value === "string" && DIETARY_REGIMES.some((r) => r.value === value);
}
