"use client";

// ============================================================
// IterUp — form profilo (Impostazioni)
// ------------------------------------------------------------
// Usato sia al primo avvio (nessun profilo esistente ancora, form
// vuoto) sia per la modifica successiva (precompilato): non è un
// one-shot immutabile, non esiste più una pagina di onboarding
// separata (era ridondante con questa) — vedi
// PRD-addendum-onboarding-form.md sezione 1 e 6.
// ============================================================

import { useState, type FormEvent } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";
import {
  ACTIVITY_LEVEL_OPTIONS,
  HEIGHT_CM_RANGE,
  WEIGHT_KG_RANGE,
  AGE_YEARS_RANGE,
  calculateAge,
  type ActivityLevel,
  type GoalMode,
  type Sex,
} from "@/lib/tdee";
import { DIET_MODES, DIETARY_REGIME_PRESETS, type DietaryRegime } from "@/lib/nutrition-options";
import TagListInput from "./TagListInput";

export interface ProfileFormState {
  fullName: string;
  sex: Sex | "";
  birthDate: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel | "";
  mode: GoalMode | "";
  dietaryRegime: DietaryRegime;
  allergies: string[];
  preferences: string[];
}

export const PROFILE_FORM_INITIAL_STATE: ProfileFormState = {
  fullName: "",
  sex: "",
  birthDate: "",
  heightCm: "",
  weightKg: "",
  activityLevel: "",
  mode: "",
  dietaryRegime: "mediterraneo",
  allergies: [],
  preferences: [],
};

function validate(form: ProfileFormState): string | null {
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
  if (!form.mode) return "Seleziona il tipo di dieta.";
  if (!form.dietaryRegime) return "Seleziona il regime alimentare.";

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

interface ProfileFormProps {
  initialValues?: ProfileFormState;
  submitLabel: string;
  submittingLabel: string;
  onSuccess: () => void;
}

export default function ProfileForm({
  initialValues,
  submitLabel,
  submittingLabel,
  onSuccess,
}: ProfileFormProps) {
  const [form, setForm] = useState<ProfileFormState>(initialValues ?? PROFILE_FORM_INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addingRegime, setAddingRegime] = useState(false);
  const [customRegimeDraft, setCustomRegimeDraft] = useState("");

  function update<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
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
      const res = await apiFetch("/api/profile", {
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
          dietaryRegime: form.dietaryRegime,
          allergies: form.allergies,
          preferences: form.preferences,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Errore durante il salvataggio.");
        setSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setError("Errore di rete durante il salvataggio. Riprova.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
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
        <label style={labelStyle}>Tipo di dieta</label>
        <div className="grid grid-cols-2" style={{ gap: spacing.sm }}>
          {DIET_MODES.map((opt) => (
            <label
              key={opt.value}
              style={{
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
        <p style={{ color: colors.textMuted, fontSize: font.size.xs, marginTop: spacing.xs }}>
          Determina le kcal/macro giornaliere target: puoi cambiarlo in qualsiasi momento dal profilo.
        </p>
      </div>

      <div>
        <label style={labelStyle} htmlFor="dietaryRegime">
          Regime alimentare
        </label>
        {addingRegime ? (
          <div style={{ display: "flex", gap: spacing.xs }}>
            <input
              type="text"
              autoFocus
              style={inputStyle}
              value={customRegimeDraft}
              onChange={(e) => setCustomRegimeDraft(e.target.value)}
              placeholder="Es. pescetariano, low-fodmap..."
            />
            <button
              type="button"
              onClick={() => {
                const value = customRegimeDraft.trim();
                if (value) update("dietaryRegime", value as DietaryRegime);
                setAddingRegime(false);
                setCustomRegimeDraft("");
              }}
              style={{
                backgroundColor: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: `${spacing.sm} ${spacing.md}`,
                color: colors.textPrimary,
                fontSize: font.size.sm,
                whiteSpace: "nowrap",
              }}
            >
              Aggiungi
            </button>
          </div>
        ) : (
          <select
            id="dietaryRegime"
            style={inputStyle}
            value={form.dietaryRegime}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setAddingRegime(true);
              } else {
                update("dietaryRegime", e.target.value as DietaryRegime);
              }
            }}
            required
          >
            {DIETARY_REGIME_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {!DIETARY_REGIME_PRESETS.some((opt) => opt.value === form.dietaryRegime) &&
              form.dietaryRegime && <option value={form.dietaryRegime}>{form.dietaryRegime}</option>}
            <option value="__custom__">+ Aggiungi nuovo regime...</option>
          </select>
        )}
      </div>

      <div>
        <label style={labelStyle}>Allergie e intolleranze</label>
        <TagListInput
          values={form.allergies}
          onChange={(v) => update("allergies", v)}
          placeholder="Es. lattosio, glutine, crostacei..."
          tagColor={colors.danger}
        />
        <p style={{ color: colors.textMuted, fontSize: font.size.xs, marginTop: spacing.xs }}>
          Vincolo rigido: il generatore pasti AI non proporrà mai questi ingredienti.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Preferenze alimentari</label>
        <TagListInput
          values={form.preferences}
          onChange={(v) => update("preferences", v)}
          placeholder="Es. niente pesce, adoro i legumi..."
          tagColor={colors.accent}
        />
        <p style={{ color: colors.textMuted, fontSize: font.size.xs, marginTop: spacing.xs }}>
          Preferenza di gusto, non vincolante: orienta le proposte senza bloccarle.
        </p>
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
        {submitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
