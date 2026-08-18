"use client";

// ============================================================
// IterUp — CRUD integratori posseduti (sezione Impostazioni)
// ------------------------------------------------------------
// Vedi PRD-addendum-onboarding-form.md sezione 5.1. Il generatore AI
// di combinazioni/dosaggi e la chat Q&A (sezioni 4 e 5.2) non sono
// ancora implementati: in attesa del file di dettaglio OpenRouter.
// ============================================================

import { useEffect, useState, type FormEvent } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import type { Tables } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";

type Supplement = Tables<"supplements">;

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

export default function SupplementsManager() {
  const [items, setItems] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/supplements");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento");
      setItems(json.supplements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dosage, unit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");
      setName("");
      setDosage("");
      setUnit("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await apiFetch(`/api/supplements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Errore nella cancellazione");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 sm:grid-cols-3"
        style={{ gap: spacing.sm }}
      >
        <input
          style={inputStyle}
          placeholder="Nome (es. Berberina)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          style={inputStyle}
          placeholder="Principio attivo/dosaggio (es. Berberina HCL 500mg)"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
        />
        <div style={{ display: "flex", gap: spacing.xs }}>
          <input
            style={inputStyle}
            placeholder="Unità (es. 1 capsula)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving}
            style={{
              backgroundColor: colors.primary,
              color: colors.background,
              border: "none",
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              whiteSpace: "nowrap",
              opacity: saving ? 0.6 : 1,
            }}
          >
            Aggiungi
          </button>
        </div>
      </form>

      {error && <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>}

      {loading ? (
        <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>
      ) : items.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
          Nessun integratore registrato.
        </p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between"
              style={{
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex flex-col">
                <span style={{ fontSize: font.size.sm, fontWeight: font.weight.medium }}>
                  {s.name}
                </span>
                <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                  {[s.dosage, s.unit].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                aria-label={`Rimuovi ${s.name}`}
                style={{ color: colors.textMuted, fontSize: font.size.lg }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
