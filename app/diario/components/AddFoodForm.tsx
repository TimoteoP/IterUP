"use client";

// ============================================================
// IterUp — form "aggiungi alimento" (DB foods condiviso)
// ------------------------------------------------------------
// Per alimenti non presenti tra le ~180 voci curate. Crea una riga
// in `foods` con source='manual' via POST /api/foods, poi seleziona
// automaticamente il nuovo alimento nel diario.
// ============================================================

import { useState, type FormEvent } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import type { FoodResult } from "../types";
import { apiFetch } from "@/lib/api-client";

interface AddFoodFormProps {
  initialName?: string;
  onCreated: (food: FoodResult) => void;
  onCancel: () => void;
}

const fieldStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: `${spacing.sm} ${spacing.md}`,
  fontSize: font.size.sm,
  fontFamily: font.sans,
  width: "100%",
};

export default function AddFoodForm({ initialName, onCreated, onCancel }: AddFoodFormProps) {
  const [name, setName] = useState(initialName ?? "");
  const [category, setCategory] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const kcal100g = Number(kcal);
    const protein100g = Number(protein);
    const carbs100g = Number(carbs);
    const fat100g = Number(fat);
    const fiber100g = fiber.trim() ? Number(fiber) : null;

    if (!name.trim()) {
      setError("Il nome è obbligatorio.");
      return;
    }
    if (![kcal100g, protein100g, carbs100g, fat100g].every((v) => Number.isFinite(v) && v >= 0)) {
      setError("kcal/proteine/carboidrati/grassi devono essere numeri >= 0.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          kcal_100g: kcal100g,
          protein_100g: protein100g,
          carbs_100g: carbs100g,
          fat_100g: fat100g,
          fiber_100g: fiber100g,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella creazione dell'alimento");
      onCreated(json.food);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <input
        style={fieldStyle}
        placeholder="Nome alimento"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        style={fieldStyle}
        placeholder="Categoria (opzionale, es. proteine)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>Valori per 100g:</p>
      <div className="grid grid-cols-2" style={{ gap: spacing.sm }}>
        <input
          style={fieldStyle}
          type="number"
          inputMode="decimal"
          placeholder="Kcal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          required
        />
        <input
          style={fieldStyle}
          type="number"
          inputMode="decimal"
          placeholder="Proteine (g)"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          required
        />
        <input
          style={fieldStyle}
          type="number"
          inputMode="decimal"
          placeholder="Carboidrati (g)"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
          required
        />
        <input
          style={fieldStyle}
          type="number"
          inputMode="decimal"
          placeholder="Grassi (g)"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          required
        />
        <input
          style={fieldStyle}
          type="number"
          inputMode="decimal"
          placeholder="Fibre (g, opzionale)"
          value={fiber}
          onChange={(e) => setFiber(e.target.value)}
        />
      </div>

      {error && <p style={{ fontSize: font.size.xs, color: colors.danger }}>{error}</p>}

      <div className="flex" style={{ gap: spacing.sm }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            backgroundColor: colors.primary,
            color: colors.background,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Salvataggio…" : "Crea alimento"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            color: colors.textSecondary,
            fontSize: font.size.sm,
            padding: `${spacing.sm} ${spacing.md}`,
          }}
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
