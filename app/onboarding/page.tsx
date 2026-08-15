"use client";

// ============================================================
// IterUp — Onboarding (A1)
// ------------------------------------------------------------
// Form dati fisici + obiettivo, salva profilo/peso/target via
// /api/onboarding/save. Nessun login: single-user (CLAUDE.md regola 1).
// ============================================================

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import {
  ACTIVITY_LEVEL_OPTIONS,
  GOAL_MODE_OPTIONS,
  HEIGHT_CM_RANGE,
  WEIGHT_KG_RANGE,
  AGE_YEARS_RANGE,
  calculateAge,
  type ActivityLevel,
  type GoalMode,
  type Sex,
} from "@/lib/tdee";

interface FormState {
  fullName: string;
  sex: Sex | "";
  birthDate: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel | "";
  mode: GoalMode | "";
}

const INITIAL_STATE: FormState = {
  fullName: "",
  sex: "",
  birthDate: "",
  heightCm: "",
  weightKg: "",
  activityLevel: "",
  mode: "",
};

function validate(form: FormState): string | null {
  if (!form.fullName.trim()) return "Inserisci il tuo nome.";
  if (form.sex !== "m" && form.sex !== "f") return "Seleziona il sesso.";
  if (!form.birthDate) return "Inserisci la data di nascita.";

  const birthDateObj = new Date(form.birthDate);
  if (Number.isNaN(birthDateObj.getTime()) || birthDateObj > new Date()) {
    return "Data di nascita non valida.";
  }
  const age = calculateAge(form.birthDate);
  if (age < AGE_YEARS_RANGE.min || age > AGE_YEARS_RANGE.max) {
    return `Età fuori range (${AGE_YEARS_RANGE.min}-${AGE_YEARS_RANGE.max} anni).`;
  }

  const heightCm = Number(form.heightCm);
  if (!Number.isFinite(heightCm) || heightCm < HEIGHT_CM_RANGE.min || heightCm > HEIGHT_CM_RANGE.max) {
    return `Altezza fuori range (${HEIGHT_CM_RANGE.min}-${HEIGHT_CM_RANGE.max} cm).`;
  }

  const weightKg = Number(form.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_KG_RANGE.min || weightKg > WEIGHT_KG_RANGE.max) {
    return `Peso fuori range (${WEIGHT_KG_RANGE.min}-${WEIGHT_KG_RANGE.max} kg).`;
  }

  if (!form.activityLevel) return "Seleziona il livello di attività.";
  if (!form.mode) return "Seleziona il tuo obiettivo.";

  return null;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: `${spacing.sm} ${spacing.md}`,
  fontSize: font.size.md,
  fontFamily: font.sans,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  color: colors.textSecondary,
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  marginBottom: spacing.xs,
  display: "block",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          sex: form.sex,
          birthDate: form.birthDate,
          heightCm: Number(form.heightCm),
          weightKg: Number(form.weightKg),
          activityLevel: form.activityLevel,
          mode: form.mode,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Errore durante il salvataggio.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      // Altri moduli stanno costruendo /diario in parallelo: redirect
      // best-effort, ma mostriamo comunque la conferma se la route non esiste.
      setTimeout(() => {
        router.push("/diario");
      }, 1200);
    } catch {
      setError("Errore di rete durante il salvataggio. Riprova.");
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        backgroundColor: colors.background,
        minHeight: "100vh",
        color: colors.textPrimary,
        fontFamily: font.sans,
      }}
      className="flex justify-center px-4 py-12"
    >
      <div className="w-full max-w-md" style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.textPrimary }}>
            Benvenuto su IterUp
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            Raccontaci qualcosa di te per calcolare il tuo fabbisogno calorico e i tuoi target macro.
          </p>
        </div>

        {success ? (
          <div
            style={{
              backgroundColor: colors.primaryMuted,
              border: `1px solid ${colors.primary}`,
              borderRadius: radius.lg,
              padding: spacing.lg,
              color: colors.textPrimary,
            }}
          >
            <p style={{ fontWeight: font.weight.semibold, marginBottom: spacing.xs }}>
              Profilo salvato con successo.
            </p>
            <p style={{ color: colors.textSecondary, fontSize: font.size.sm }}>
              Ti stiamo portando al diario alimentare...
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
          >
            <div>
              <label style={labelStyle} htmlFor="fullName">
                Nome
              </label>
              <input
                id="fullName"
                type="text"
                style={inputStyle}
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Il tuo nome"
                autoComplete="name"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Sesso</label>
              <div style={{ display: "flex", gap: spacing.md }}>
                {(["m", "f"] as const).map((value) => (
                  <label
                    key={value}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing.xs,
                      padding: spacing.sm,
                      borderRadius: radius.md,
                      border: `1px solid ${form.sex === value ? colors.primary : colors.border}`,
                      backgroundColor: form.sex === value ? colors.primaryMuted : colors.surfaceAlt,
                      cursor: "pointer",
                      fontSize: font.size.sm,
                      color: colors.textPrimary,
                    }}
                  >
                    <input
                      type="radio"
                      name="sex"
                      value={value}
                      checked={form.sex === value}
                      onChange={() => update("sex", value)}
                      style={{ accentColor: colors.primary }}
                    />
                    {value === "m" ? "Uomo" : "Donna"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="birthDate">
                Data di nascita
              </label>
              <input
                id="birthDate"
                type="date"
                style={inputStyle}
                value={form.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2" style={{ gap: spacing.md }}>
              <div>
                <label style={labelStyle} htmlFor="heightCm">
                  Altezza (cm)
                </label>
                <input
                  id="heightCm"
                  type="number"
                  inputMode="decimal"
                  style={inputStyle}
                  value={form.heightCm}
                  onChange={(e) => update("heightCm", e.target.value)}
                  min={HEIGHT_CM_RANGE.min}
                  max={HEIGHT_CM_RANGE.max}
                  placeholder="175"
                  required
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="weightKg">
                  Peso attuale (kg)
                </label>
                <input
                  id="weightKg"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  style={inputStyle}
                  value={form.weightKg}
                  onChange={(e) => update("weightKg", e.target.value)}
                  min={WEIGHT_KG_RANGE.min}
                  max={WEIGHT_KG_RANGE.max}
                  placeholder="70"
                  required
                />
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="activityLevel">
                Livello di attività
              </label>
              <select
                id="activityLevel"
                style={inputStyle}
                value={form.activityLevel}
                onChange={(e) => update("activityLevel", e.target.value as ActivityLevel)}
                required
              >
                <option value="" disabled>
                  Seleziona...
                </option>
                {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Obiettivo</label>
              <div style={{ display: "flex", gap: spacing.sm }}>
                {GOAL_MODE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: spacing.sm,
                      borderRadius: radius.md,
                      border: `1px solid ${form.mode === opt.value ? colors.primary : colors.border}`,
                      backgroundColor: form.mode === opt.value ? colors.primaryMuted : colors.surfaceAlt,
                      cursor: "pointer",
                      fontSize: font.size.sm,
                      color: colors.textPrimary,
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={opt.value}
                      checked={form.mode === opt.value}
                      onChange={() => update("mode", opt.value)}
                      style={{ display: "none" }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: colors.surfaceAlt,
                  border: `1px solid ${colors.danger}`,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.danger,
                  fontSize: font.size.sm,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: colors.primary,
                color: colors.background,
                border: "none",
                borderRadius: radius.md,
                padding: `${spacing.sm} ${spacing.md}`,
                fontSize: font.size.md,
                fontWeight: font.weight.semibold,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Salvataggio..." : "Calcola il mio piano"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
