// ============================================================
// IterUp — validazione condivisa per le misure corporee
// ------------------------------------------------------------
// Modulo "puro" (nessun import server-only): può essere importato
// sia da app/api/body-metrics/route.ts (server) sia da
// app/misure/page.tsx (client) per tenere i range in un solo posto.
// Non è un route.ts, quindi non è soggetto ai vincoli sugli export
// dei route handler di Next.js.
// ============================================================

// Range fisici ragionevoli.
export const WEIGHT_RANGE = { min: 30, max: 300 } as const;
export const CIRCUMFERENCE_RANGE = { min: 10, max: 200 } as const;

export type BodyMetricsPayload = {
  recorded_at?: string;
  weight_kg?: number | string | null;
  neck_cm?: number | string | null;
  chest_cm?: number | string | null;
  waist_cm?: number | string | null;
  thigh_cm?: number | string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Converte in numero, tollerando stringhe vuote/undefined/null come "assente". */
function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return NaN as unknown as number;
  return n;
}

export function validateBodyMetricsPayload(body: BodyMetricsPayload): {
  errors: string[];
  recorded_at: string;
  weight_kg: number;
  neck_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  thigh_cm: number | null;
} {
  const errors: string[] = [];

  const recorded_at = body.recorded_at?.trim() || todayISODate();
  if (!DATE_RE.test(recorded_at) || Number.isNaN(Date.parse(recorded_at))) {
    errors.push("Data non valida (formato atteso: YYYY-MM-DD).");
  }

  const weightParsed = parseOptionalNumber(body.weight_kg);
  let weight_kg = NaN;
  if (weightParsed === undefined || weightParsed === null) {
    errors.push("Il peso è obbligatorio.");
  } else if (Number.isNaN(weightParsed)) {
    errors.push("Il peso deve essere un numero.");
  } else if (weightParsed < WEIGHT_RANGE.min || weightParsed > WEIGHT_RANGE.max) {
    errors.push(`Il peso deve essere tra ${WEIGHT_RANGE.min} e ${WEIGHT_RANGE.max} kg.`);
  } else {
    weight_kg = weightParsed;
  }

  function validateCircumference(label: string, value: number | null | undefined): number | null {
    if (value === undefined || value === null) return null;
    if (Number.isNaN(value)) {
      errors.push(`${label} deve essere un numero.`);
      return null;
    }
    if (value < CIRCUMFERENCE_RANGE.min || value > CIRCUMFERENCE_RANGE.max) {
      errors.push(
        `${label} deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`
      );
      return null;
    }
    return value;
  }

  const neck_cm = validateCircumference("Il collo", parseOptionalNumber(body.neck_cm));
  const chest_cm = validateCircumference("Il petto", parseOptionalNumber(body.chest_cm));
  const waist_cm = validateCircumference("La vita", parseOptionalNumber(body.waist_cm));
  const thigh_cm = validateCircumference("La coscia", parseOptionalNumber(body.thigh_cm));

  return { errors, recorded_at, weight_kg, neck_cm, chest_cm, waist_cm, thigh_cm };
}
