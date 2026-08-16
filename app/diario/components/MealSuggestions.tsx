"use client";

// ============================================================
// IterUp — Generatore pasti AI (A3), UI proposte
// ------------------------------------------------------------
// Chiama /api/suggest-meal per il mealType corrente, mostra le 5
// proposte validate (macro già ricalcolati server-side dagli
// ingredienti reali) e permette di aggiungerne una al diario: un
// POST /api/logs per ogni ingrediente (stesso meal_type/data), dato
// che daily_logs non modella un "pasto composto" — vedi
// PRD-addendum-openrouter.md sezione 7.
// ============================================================

import { useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";

interface ValidatedIngredient {
  alimento: string;
  food_id: string;
  quantita_g: number;
}

interface ValidatedProposal {
  nome: string;
  descrizione: string;
  ingredienti: ValidatedIngredient[];
  macro: { kcal: number; proteine_g: number; carboidrati_g: number; grassi_g: number };
  tipo_pasto: string;
  note_regime?: string;
}

interface SuggestResponse {
  target: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  modelUsed: string | null;
  proposte: ValidatedProposal[];
}

interface MealSuggestionsProps {
  mealType: "colazione" | "pranzo" | "cena" | "spuntino";
  logDate: string;
  onLogged: () => void;
}

export default function MealSuggestions({ mealType, logDate, onLogged }: MealSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/suggest-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella generazione");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  async function addProposal(proposal: ValidatedProposal, index: number) {
    setAddingIndex(index);
    setError(null);
    try {
      for (const ing of proposal.ingredienti) {
        const res = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            food_id: ing.food_id,
            quantity_g: ing.quantita_g,
            meal_type: mealType,
            logged_at: logDate,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `Errore salvando ${ing.alimento}`);
        }
      }
      setOpen(false);
      setData(null);
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setAddingIndex(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        style={{
          fontSize: font.size.xs,
          color: colors.accent,
          border: `1px solid ${colors.accent}`,
          borderRadius: radius.full,
          padding: `2px ${spacing.sm}`,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Genero…" : "✨ Suggerisci con AI"}
      </button>

      {open && (
        <div
          style={{
            marginTop: spacing.sm,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            backgroundColor: colors.surfaceAlt,
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
          }}
        >
          {loading && (
            <p style={{ fontSize: font.size.sm, color: colors.textMuted }}>
              Generazione proposte in corso…
            </p>
          )}
          {error && <p style={{ fontSize: font.size.sm, color: colors.danger }}>{error}</p>}
          {data && data.proposte.length === 0 && !loading && (
            <p style={{ fontSize: font.size.sm, color: colors.textMuted }}>
              Nessuna proposta valida generata. Riprova.
            </p>
          )}
          {data?.proposte.map((p, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: spacing.sm,
                backgroundColor: colors.surface,
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold }}>
                  {p.nome}
                </span>
                <button
                  onClick={() => addProposal(p, i)}
                  disabled={addingIndex !== null}
                  style={{
                    fontSize: font.size.xs,
                    backgroundColor: colors.primary,
                    color: colors.background,
                    borderRadius: radius.sm,
                    padding: `2px ${spacing.sm}`,
                    fontWeight: font.weight.medium,
                    opacity: addingIndex !== null ? 0.6 : 1,
                  }}
                >
                  {addingIndex === i ? "Aggiungo…" : "Aggiungi"}
                </button>
              </div>
              <p style={{ fontSize: font.size.xs, color: colors.textSecondary, marginTop: spacing.xs }}>
                {p.descrizione}
              </p>
              <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.xs }}>
                {p.ingredienti.map((i) => `${i.alimento} (${i.quantita_g}g)`).join(", ")}
              </p>
              <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.xs }}>
                {Math.round(p.macro.kcal)} kcal · P {p.macro.proteine_g}g · C {p.macro.carboidrati_g}g
                · G {p.macro.grassi_g}g
                {p.note_regime ? ` · ${p.note_regime}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
