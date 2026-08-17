// ============================================================
// IterUp — BMI e "Indice Corporeo IterUp" (indicatori dashboard)
// ------------------------------------------------------------
// Funzioni pure, nessun accesso DB: prendono in input lo storico
// body_metrics già letto altrove (vedi app/api/dashboard/route.ts).
// ============================================================

export interface BodyMetricPoint {
  date: string; // recorded_at, YYYY-MM-DD
  weightKg: number | null;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  thighCm: number | null;
}

// ------------------------------------------------------------
// BMI (Body Mass Index) — indicatore standard, peso/altezza².
// ------------------------------------------------------------
export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export type BMICategory = "sottopeso" | "normopeso" | "sovrappeso" | "obesità";

/** Categorie standard OMS (adulti). */
export function bmiCategory(bmi: number): BMICategory {
  if (bmi < 18.5) return "sottopeso";
  if (bmi < 25) return "normopeso";
  if (bmi < 30) return "sovrappeso";
  return "obesità";
}

// ------------------------------------------------------------
// Indice Corporeo IterUp — indice composito peso + circonferenze,
// pensato per seguire il trend di ricomposizione corporea in modo più
// stabile del solo peso (che include acqua/glicogeno, molto rumoroso
// giorno per giorno).
//
// Metodo: ogni metrica viene indicizzata al suo primo valore
// disponibile (= 100), poi si fa una media pesata delle metriche
// disponibili in quel giorno. Pesi assegnati dal supervisore in base
// a quanto ogni misura è tipicamente reattiva alla perdita di grasso
// (non uno standard clinico, una scelta editoriale esplicita,
// rivedibile):
//   - vita (waist)   35%: la più reattiva al grasso viscerale/addominale
//   - peso (weight)  30%: segnale globale, ma include acqua/glicogeno
//   - coscia (thigh) 15%: deposito sottocutaneo, cambia più lentamente
//   - collo (neck)   12%: cambia lentamente, riferimento stabile
//     (stesso principio della formula US Navy per il BF%)
//   - petto (chest)   8%: il più "rumoroso", risente anche di massa
//     muscolare oltre che di grasso — peso minimo apposta
// Se in un giorno mancano alcune metriche, i pesi delle disponibili
// vengono rinormalizzati (sommano comunque a 100%).
// ------------------------------------------------------------

const BODY_INDEX_WEIGHTS = {
  waistCm: 0.35,
  weightKg: 0.3,
  thighCm: 0.15,
  neckCm: 0.12,
  chestCm: 0.08,
} as const;

export interface BodyIndexPoint {
  date: string;
  index: number;
}

export function calculateBodyIndex(history: BodyMetricPoint[]): BodyIndexPoint[] {
  const metrics = ["waistCm", "weightKg", "thighCm", "neckCm", "chestCm"] as const;

  // Baseline per metrica = primo valore non nullo in ordine cronologico.
  const baseline: Partial<Record<(typeof metrics)[number], number>> = {};
  for (const row of history) {
    for (const m of metrics) {
      if (baseline[m] === undefined && row[m] !== null) {
        baseline[m] = row[m] as number;
      }
    }
  }

  const result: BodyIndexPoint[] = [];
  for (const row of history) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const m of metrics) {
      const value = row[m];
      const base = baseline[m];
      if (value === null || base === undefined || base === 0) continue;
      const normalized = (value / base) * 100;
      const weight = BODY_INDEX_WEIGHTS[m];
      weightedSum += normalized * weight;
      weightTotal += weight;
    }
    if (weightTotal === 0) continue; // nessuna metrica disponibile quel giorno
    result.push({ date: row.date, index: Math.round((weightedSum / weightTotal) * 100) / 100 });
  }
  return result;
}
