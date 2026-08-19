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

// Preset noti, mostrati come suggerimenti nella UI (vedi
// app/impostazioni/ProfileForm.tsx): lista aperta, l'utente può
// aggiungerne altri liberamente da UI (nessun CHECK in DB su questo
// campo, vedi schema.sql). Non hardcodare regimi altrove: chi ha
// bisogno della label per un valore custom non presente qui deve
// mostrare il valore stesso (vedi dietaryRegimeLabel sotto).
export const DIETARY_REGIME_PRESETS = [
  { value: "mediterraneo", label: "Mediterraneo" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "high_carb", label: "High-carb" },
  { value: "vegano", label: "Vegano" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "fruttariano", label: "Fruttariano" },
  { value: "crudista", label: "Crudista" },
  { value: "low_carb", label: "Low-carb" },
  { value: "chetogenica_ciclica", label: "Chetogenica ciclica" },
] as const;

// Regime alimentare: stringa libera (non enum chiuso), vedi
// PRD-addendum-onboarding-form.md sezione 2.2 ("lista estendibile").
export type DietaryRegime = string;

/** Etichetta leggibile per un regime: usa il preset se noto, altrimenti il valore stesso. */
export function dietaryRegimeLabel(value: string): string {
  return DIETARY_REGIME_PRESETS.find((r) => r.value === value)?.label ?? value;
}

export interface MacroSplit {
  /** % di kcal giornaliere da carboidrati/proteine/grassi. Somma a 100. */
  carbPct: number;
  proteinPct: number;
  fatPct: number;
}

// Split macro per regime alimentare, su indicazione esplicita
// dell'utente (es. Keto 10/35/55, Mediterranea 55/30/15). Valori per
// i regimi non elencati esplicitamente dall'utente sono una stima
// ragionevole del supervisore, non uno standard nutrizionale
// certificato — rivedibili. Il regime determina COME si dividono le
// kcal target (già calcolate da TDEE + obiettivo, vedi lib/tdee.ts),
// non le kcal stesse.
const REGIME_MACRO_SPLITS: Record<string, MacroSplit> = {
  mediterraneo: { carbPct: 55, proteinPct: 30, fatPct: 15 },
  keto: { carbPct: 10, proteinPct: 35, fatPct: 55 },
  paleo: { carbPct: 30, proteinPct: 35, fatPct: 35 },
  high_carb: { carbPct: 65, proteinPct: 20, fatPct: 15 },
  vegano: { carbPct: 55, proteinPct: 20, fatPct: 25 },
  vegetariano: { carbPct: 50, proteinPct: 25, fatPct: 25 },
  fruttariano: { carbPct: 80, proteinPct: 8, fatPct: 12 },
  crudista: { carbPct: 50, proteinPct: 20, fatPct: 30 },
  low_carb: { carbPct: 20, proteinPct: 35, fatPct: 45 },
  chetogenica_ciclica: { carbPct: 15, proteinPct: 30, fatPct: 55 },
};

// Split di fallback per regimi custom creati liberamente dall'utente
// (non in REGIME_MACRO_SPLITS) quando non hanno impostato un loro
// split personalizzato: un mix bilanciato, non specifico.
const DEFAULT_MACRO_SPLIT: MacroSplit = { carbPct: 45, proteinPct: 30, fatPct: 25 };

const MACRO_SPLIT_SUM_TOLERANCE = 0.5;

/** Valida uno split macro: tre numeri finiti, non negativi, che sommano a 100 (± arrotondamento). */
export function isValidMacroSplit(value: unknown): value is MacroSplit {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const { carbPct, proteinPct, fatPct } = v;
  if (![carbPct, proteinPct, fatPct].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
    return false;
  }
  const sum = (carbPct as number) + (proteinPct as number) + (fatPct as number);
  return Math.abs(sum - 100) <= MACRO_SPLIT_SUM_TOLERANCE;
}

/**
 * Split macro (% carb/proteine/grassi) per un regime: preset noto
 * (ha sempre la priorità), altrimenti lo split personalizzato
 * dell'utente se presente e valido (vedi profiles.custom_macro_split
 * e isValidMacroSplit), altrimenti il fallback generico bilanciato.
 */
export function macroSplitForRegime(regime: string, customSplit?: unknown): MacroSplit {
  const preset = REGIME_MACRO_SPLITS[regime];
  if (preset) return preset;
  if (isValidMacroSplit(customSplit)) return customSplit;
  return DEFAULT_MACRO_SPLIT;
}

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

const DIETARY_REGIME_MAX_LENGTH = 40;

/** Valida un regime alimentare libero: stringa non vuota, lunghezza ragionevole. */
export function isDietaryRegime(value: unknown): value is DietaryRegime {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= DIETARY_REGIME_MAX_LENGTH
  );
}
