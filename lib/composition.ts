// ============================================================
// IterUp — Bussola di Ricomposizione Corporea (lib/composition.ts)
// ------------------------------------------------------------
// Funzioni pure, nessun accesso DB/rete — vedi
// PRD-addendum-bussola-ricomposizione.md sezioni 4-5. Le formule
// vanno "portate 1:1", non approssimate: non modificare le costanti
// (495, 450, 0.19077, 7700, 0.15, 0.05, 1.5, ecc.) senza conferma
// esplicita dell'utente.
// ============================================================

import { calculateMaintenanceTDEE } from "./tdee";
import type { ActivityLevel, Sex } from "./tdee";

// ------------------------------------------------------------
// 1. BF% — formula Navy (Hodgdon & Beckett, 1984)
// ------------------------------------------------------------
export interface NavyBFInput {
  sex: Sex;
  waistCm: number;
  neckCm: number;
  heightCm: number;
  /** Richiesto (>0) se sex === 'f', ignorato se 'm'. */
  hipCm?: number | null;
}

/** BF% (percentuale di massa grassa) con la formula Navy. cm in input. */
export function calculateNavyBF({ sex, waistCm, neckCm, heightCm, hipCm }: NavyBFInput): number {
  if (sex === "m") {
    const diff = waistCm - neckCm;
    if (diff <= 0) throw new Error("waistCm deve essere maggiore di neckCm per il calcolo BF% uomo.");
    const denom = 1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm);
    return 495 / denom - 450;
  }

  if (!hipCm || hipCm <= 0) {
    throw new Error("hipCm è richiesto (>0) per il calcolo BF% donna.");
  }
  const sum = waistCm + hipCm - neckCm;
  if (sum <= 0) throw new Error("waistCm + hipCm - neckCm deve essere positivo per il calcolo BF% donna.");
  const denom = 1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(heightCm);
  return 495 / denom - 450;
}

// ------------------------------------------------------------
// 2. FM / FFM
// ------------------------------------------------------------
export interface FatMassResult {
  /** Fat Mass, kg — massa grassa. */
  fm: number;
  /** Fat-Free Mass, kg — massa magra. */
  ffm: number;
}

export function calculateFatMass(weightKg: number, bfPercent: number): FatMassResult {
  const fm = (weightKg * bfPercent) / 100;
  return { fm, ffm: weightKg - fm };
}

// ------------------------------------------------------------
// 3. TDEE — riesporta Mifflin-St Jeor da lib/tdee.ts (stessa formula,
// stessi moltiplicatori di attività: non duplicata qui).
// ------------------------------------------------------------
export function calculateMaintenance(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel
): { bmr: number; tdee: number } {
  return calculateMaintenanceTDEE(sex, weightKg, heightCm, age, activityLevel);
}

// ------------------------------------------------------------
// 4. Bilancio energetico del periodo (solo se kcal_period presente)
// ------------------------------------------------------------
export interface EnergyBalanceInput {
  tdee: number;
  days: number;
  kcalPeriod: number;
}

export interface EnergyBalanceResult {
  maintenancePeriod: number;
  balance: number;
  /** Δpeso atteso dal solo bilancio energetico, kg. 7700 kcal/kg è
   * un'approssimazione statica (Wishnofsky, 1958) — va presentata in
   * UI solo come riferimento direzionale, non una previsione precisa. */
  expectedDeltaWeightKg: number;
}

const KCAL_PER_KG_WISHNOFSKY = 7700;

export function calculateEnergyBalance({ tdee, days, kcalPeriod }: EnergyBalanceInput): EnergyBalanceResult {
  const clampedDays = Math.max(1, days);
  const maintenancePeriod = tdee * clampedDays;
  const balance = kcalPeriod - maintenancePeriod;
  return {
    maintenancePeriod,
    balance,
    expectedDeltaWeightKg: balance / KCAL_PER_KG_WISHNOFSKY,
  };
}

// ------------------------------------------------------------
// 5. Indice di Ricomposizione (IR), tra due check-in consecutivi
// ------------------------------------------------------------
export interface RecompositionInput {
  ffmNow: number;
  ffmPrev: number;
  fmNow: number;
  fmPrev: number;
  /** -1 | 0 | 1 */
  neckFeel: number;
  /** -1 | 0 | 1 */
  wristFeel: number;
}

export interface RecompositionResult {
  irRaw: number;
  qualNudge: number;
  compScoreRaw: number;
  /** Clampato in [-1, 1]. */
  compScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateRecompositionIndex({
  ffmNow,
  ffmPrev,
  fmNow,
  fmPrev,
  neckFeel,
  wristFeel,
}: RecompositionInput): RecompositionResult {
  const irRaw = ffmNow - ffmPrev - (fmNow - fmPrev);
  const qualNudge = neckFeel * 0.15 + wristFeel * 0.1;
  const compScoreRaw = irRaw + qualNudge;
  const compScore = clamp(compScoreRaw / 1.5, -1, 1);
  return { irRaw, qualNudge, compScoreRaw, compScore };
}

// ------------------------------------------------------------
// 6. Asse energetico normalizzato
// ------------------------------------------------------------
export interface EnergyScoreInput {
  balance: number | null;
  maintenancePeriod: number | null;
  weightNow: number;
  weightPrev: number;
}

export function calculateEnergyScore({ balance, maintenancePeriod, weightNow, weightPrev }: EnergyScoreInput): number {
  if (balance !== null && maintenancePeriod !== null) {
    return clamp(balance / (Math.abs(maintenancePeriod) * 0.15), -1, 1);
  }
  return clamp((weightNow - weightPrev) / 1.5, -1, 1);
}

// ------------------------------------------------------------
// 7. Direzione (5 zone + ambigua) — replica esatta della logica del
// prototipo, applicata in quest'ordine (vedi addendum sezione 5).
// ------------------------------------------------------------
export type DirectionZone =
  | "mantenimento_stabile"
  | "ricomposizione_ideale"
  | "bulk_pulito"
  | "accumulo_grasso"
  | "perdita_muscolare"
  | "ambigua";

export interface DirectionResult {
  zone: DirectionZone;
  label: string;
  description: string;
  /** true per "perdita muscolare": va mostrata come warning, non neutra. */
  isWarning: boolean;
}

export interface DirectionInput {
  compScoreRaw: number;
  /** null se kcal_period non disponibile sull'ultimo check-in. */
  balance: number | null;
  maintenancePeriod: number | null;
  weightNow: number;
  weightPrev: number;
}

const DIRECTION_ZONES: Record<DirectionZone, { label: string; description: string; isWarning: boolean }> = {
  mantenimento_stabile: {
    label: "Mantenimento stabile",
    description: "Peso e composizione corporea sono stabili: bilancio energetico vicino al mantenimento, nessuna variazione significativa di massa grassa/magra.",
    isWarning: false,
  },
  ricomposizione_ideale: {
    label: "Ricomposizione ideale",
    description: "In deficit calorico ma la massa magra si mantiene o cresce rispetto alla massa grassa: la composizione corporea sta migliorando, non solo il numero sulla bilancia.",
    isWarning: false,
  },
  bulk_pulito: {
    label: "Bulk pulito",
    description: "In surplus calorico e il guadagno va prevalentemente in massa magra: la fase di aumento sta portando muscolo più che grasso.",
    isWarning: false,
  },
  accumulo_grasso: {
    label: "Accumulo di grasso",
    description: "In surplus calorico ma il guadagno va prevalentemente in massa grassa: vale la pena rivedere l'entità del surplus o la composizione della dieta.",
    isWarning: false,
  },
  perdita_muscolare: {
    label: "Perdita muscolare",
    description: "In deficit calorico ma la massa magra sta calando più della massa grassa: rischio di perdere muscolo insieme al grasso, da correggere (proteine, allenamento di forza, entità del deficit).",
    isWarning: true,
  },
  ambigua: {
    label: "Direzione ambigua",
    description: "I segnali di questo check-in non sono abbastanza chiari per una direzione affidabile: serve un altro check-in per confermare il trend.",
    isWarning: false,
  },
};

export function determineDirection(input: DirectionInput): DirectionResult {
  const { compScoreRaw, balance, maintenancePeriod, weightNow, weightPrev } = input;

  const balanceKnown = balance !== null && maintenancePeriod !== null;
  const isDeficit = balanceKnown ? (balance as number) < 0 : weightNow < weightPrev;
  const isSurplus = balanceKnown ? (balance as number) > 0 : weightNow > weightPrev;

  let zone: DirectionZone;

  if (
    Math.abs(compScoreRaw) <= 0.05 &&
    balanceKnown &&
    Math.abs(balance as number) < (maintenancePeriod as number) * 0.05
  ) {
    zone = "mantenimento_stabile";
  } else if (isDeficit && compScoreRaw > 0.05) {
    zone = "ricomposizione_ideale";
  } else if (isSurplus && compScoreRaw > 0.05) {
    zone = "bulk_pulito";
  } else if (isSurplus && compScoreRaw < -0.05) {
    zone = "accumulo_grasso";
  } else if (isDeficit && compScoreRaw < -0.05) {
    zone = "perdita_muscolare";
  } else {
    zone = "ambigua";
  }

  return { zone, ...DIRECTION_ZONES[zone] };
}

// ------------------------------------------------------------
// Range fisici — riusati da form/validazione API.
// ------------------------------------------------------------
export const HIP_CM_RANGE = { min: 10, max: 200 } as const;
export const KCAL_PERIOD_RANGE = { min: 0, max: 200000 } as const;

export const NECK_WRIST_FEEL_OPTIONS: { value: -1 | 0 | 1; label: string }[] = [
  { value: -1, label: "Più pieno / più stretto del solito" },
  { value: 0, label: "Uguale a prima" },
  { value: 1, label: "Più sottile / vestiti più larghi" },
];

/** Giorni interi tra due date YYYY-MM-DD (minimo 1). */
export function daysBetween(prevIso: string, nowIso: string): number {
  const prev = new Date(prevIso + "T00:00:00Z").getTime();
  const now = new Date(nowIso + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((now - prev) / 86400000));
}

/** Sotto questa soglia il segnale è considerato rumoroso (fluttuazioni idriche) — vedi addendum sezione 7. */
export const SHORT_INTERVAL_WARNING_DAYS = 3;
