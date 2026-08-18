"use client";

// ============================================================
// IterUp — ricerca alimenti esterna (Open Food Facts)
// ------------------------------------------------------------
// Solo su richiesta esplicita dell'utente ("non trovato? cerca
// online"), mai automatica — vedi
// PRD-addendum-hardening-completamento.md A5. Importa un candidato
// con un tap: POST /api/foods con source='off'.
// ============================================================

import { useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import type { FoodResult } from "../types";

interface ExternalCandidate {
  source: "off";
  source_id: string;
  name: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
}

interface ExternalFoodSearchProps {
  initialQuery: string;
  onImported: (food: FoodResult) => void;
  onCancel: () => void;
}

export default function ExternalFoodSearch({ initialQuery, onImported, onCancel }: ExternalFoodSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [candidates, setCandidates] = useState<ExternalCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/foods/search-external?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella ricerca online");
      setCandidates(json.foods ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(candidate: ExternalCandidate) {
    setImportingId(candidate.source_id);
    setError(null);
    try {
      const res = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nell'importazione");
      onImported(json.food);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        backgroundColor: colors.surfaceAlt,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <div className="flex" style={{ gap: spacing.xs }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Nome del prodotto (es. Nutella, Barilla n.5...)"
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          style={{
            backgroundColor: colors.accent,
            color: colors.background,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            opacity: searching ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {searching ? "Cerco…" : "Cerca online"}
        </button>
      </div>

      {error && <p style={{ fontSize: font.size.xs, color: colors.danger }}>{error}</p>}

      {searched && !searching && candidates.length === 0 && !error && (
        <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>
          Nessun prodotto trovato su Open Food Facts con valori nutrizionali completi.
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="flex flex-col" style={{ gap: spacing.xs }}>
          {candidates.map((c) => (
            <li
              key={c.source_id}
              className="flex items-center justify-between"
              style={{
                padding: spacing.sm,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex flex-col">
                <span style={{ fontSize: font.size.sm, color: colors.textPrimary }}>{c.name}</span>
                <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                  {Math.round(c.kcal_100g)} kcal/100g · P {c.protein_100g}g · C {c.carbs_100g}g · G {c.fat_100g}g
                </span>
              </div>
              <button
                onClick={() => handleImport(c)}
                disabled={importingId !== null}
                style={{
                  fontSize: font.size.xs,
                  backgroundColor: colors.primary,
                  color: colors.background,
                  borderRadius: radius.sm,
                  padding: `2px ${spacing.sm}`,
                  fontWeight: font.weight.medium,
                  whiteSpace: "nowrap",
                  opacity: importingId !== null ? 0.6 : 1,
                }}
              >
                {importingId === c.source_id ? "Importo…" : "Importa"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onCancel} style={{ color: colors.textSecondary, fontSize: font.size.xs, alignSelf: "flex-start" }}>
        Annulla
      </button>
    </div>
  );
}
