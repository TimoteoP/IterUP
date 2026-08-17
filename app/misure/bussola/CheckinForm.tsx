"use client";

// ============================================================
// IterUp — Bussola: form check-in
// ------------------------------------------------------------
// Peso/collo/vita sempre richiesti, fianchi richiesti solo se sesso
// donna, kcal periodo opzionale, due select qualitativi (collo/
// polso) — vedi PRD-addendum-bussola-ricomposizione sezione 3 e 6.
// Validazione bloccante lato client + server (route.ts replica le
// stesse regole).
// ============================================================

import { useState, type FormEvent } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { NECK_WRIST_FEEL_OPTIONS } from "@/lib/composition";
import { WEIGHT_RANGE, CIRCUMFERENCE_RANGE, todayISODate } from "@/app/api/body-metrics/validation";

interface CheckinFormProps {
  sex: "m" | "f" | null;
  onSaved: () => void;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: `${spacing.sm} ${spacing.md}`,
  fontSize: font.size.sm,
  fontFamily: font.sans,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  color: colors.textSecondary,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  marginBottom: 4,
  display: "block",
};

export default function CheckinForm({ sex, onSaved }: CheckinFormProps) {
  const [recordedAt, setRecordedAt] = useState(todayISODate());
  const [weightKg, setWeightKg] = useState("");
  const [neckCm, setNeckCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [kcalPeriod, setKcalPeriod] = useState("");
  const [neckFeel, setNeckFeel] = useState<string>("0");
  const [wristFeel, setWristFeel] = useState<string>("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateClientSide(): string | null {
    const w = Number(weightKg);
    if (weightKg.trim() === "" || Number.isNaN(w)) return "Il peso è obbligatorio.";
    if (w < WEIGHT_RANGE.min || w > WEIGHT_RANGE.max) return `Il peso deve essere tra ${WEIGHT_RANGE.min} e ${WEIGHT_RANGE.max} kg.`;

    const n = Number(neckCm);
    if (neckCm.trim() === "" || Number.isNaN(n)) return "Il collo è obbligatorio.";
    if (n < CIRCUMFERENCE_RANGE.min || n > CIRCUMFERENCE_RANGE.max) return `Il collo deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`;

    const wa = Number(waistCm);
    if (waistCm.trim() === "" || Number.isNaN(wa)) return "La vita è obbligatoria.";
    if (wa < CIRCUMFERENCE_RANGE.min || wa > CIRCUMFERENCE_RANGE.max) return `La vita deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`;

    if (sex === "f") {
      const h = Number(hipCm);
      if (hipCm.trim() === "" || Number.isNaN(h)) return "I fianchi sono obbligatori (calcolo per sesso donna).";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const clientError = validateClientSide();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/composition/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recorded_at: recordedAt,
          weight_kg: weightKg,
          neck_cm: neckCm,
          waist_cm: waistCm,
          hip_cm: sex === "f" ? hipCm : null,
          kcal_period: kcalPeriod || null,
          neck_feel: Number(neckFeel),
          wrist_feel: Number(wristFeel),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio.");

      setWeightKg("");
      setNeckCm("");
      setWaistCm("");
      setHipCm("");
      setKcalPeriod("");
      setNeckFeel("0");
      setWristFeel("0");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: colors.surfaceAlt,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <div>
        <label style={labelStyle}>Data</label>
        <input type="date" style={inputStyle} value={recordedAt} max={todayISODate()} onChange={(e) => setRecordedAt(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: spacing.sm }}>
        <div>
          <label style={labelStyle}>Peso (kg) *</label>
          <input type="number" inputMode="decimal" step="0.1" style={inputStyle} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Collo (cm) *</label>
          <input type="number" inputMode="decimal" step="0.1" style={inputStyle} value={neckCm} onChange={(e) => setNeckCm(e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Vita (cm) *</label>
          <input type="number" inputMode="decimal" step="0.1" style={inputStyle} value={waistCm} onChange={(e) => setWaistCm(e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Fianchi (cm){sex === "f" ? " *" : ""}</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            style={{ ...inputStyle, opacity: sex === "f" ? 1 : 0.5 }}
            value={hipCm}
            onChange={(e) => setHipCm(e.target.value)}
            disabled={sex !== "f"}
            placeholder={sex !== "f" ? "non richiesto" : undefined}
            required={sex === "f"}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Kcal totali dal check-in precedente (opzionale)</label>
        <input type="number" inputMode="decimal" style={inputStyle} value={kcalPeriod} onChange={(e) => setKcalPeriod(e.target.value)} placeholder="es. 18500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: spacing.sm }}>
        <div>
          <label style={labelStyle}>Come senti il collo/colletto rispetto a prima?</label>
          <select style={inputStyle} value={neckFeel} onChange={(e) => setNeckFeel(e.target.value)}>
            {NECK_WRIST_FEEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Come senti l&apos;orologio/polso rispetto a prima?</label>
          <select style={inputStyle} value={wristFeel} onChange={(e) => setWristFeel(e.target.value)}>
            {NECK_WRIST_FEEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p style={{ fontSize: font.size.sm, color: colors.danger }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        style={{
          backgroundColor: colors.primary,
          color: colors.background,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: font.size.sm,
          fontWeight: font.weight.semibold,
          opacity: submitting ? 0.6 : 1,
          alignSelf: "flex-start",
        }}
      >
        {submitting ? "Salvataggio…" : "Salva check-in"}
      </button>
    </form>
  );
}
