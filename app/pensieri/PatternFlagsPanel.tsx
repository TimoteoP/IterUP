"use client";

// ============================================================
// IterUp — Pensieri: pattern rilevati
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 6: regole
// esplicite (non LLM), qui solo lettura + acknowledge. Nessun flag
// di tipo crisi in questo modulo (scelta esplicita dell'utente).
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";

interface PatternFlag {
  id: string;
  flag_type: string;
  summary_text: string;
  acknowledged: boolean;
  created_at: string;
}

export default function PatternFlagsPanel() {
  const [flags, setFlags] = useState<PatternFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/self-talk/patterns")
      .then((res) => res.json())
      .then((json) => setFlags(json.flags ?? []))
      .catch(() => setError("Errore nel caricamento dei pattern"));
  }, []);

  async function acknowledge(id: string) {
    setFlags((prev) => prev?.map((f) => (f.id === id ? { ...f, acknowledged: true } : f)) ?? prev);
    await apiFetch(`/api/self-talk/patterns/${id}/acknowledge`, { method: "POST" }).catch(() => {});
  }

  if (error) return <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>;
  if (flags === null) return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;

  const pending = flags.filter((f) => !f.acknowledged);

  if (pending.length === 0) {
    return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Nessun pattern da segnalare al momento.</p>;
  }

  return (
    <div className="flex flex-col" style={{ gap: spacing.sm }}>
      {pending.map((f) => (
        <div
          key={f.id}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            padding: spacing.sm,
          }}
        >
          <p style={{ fontSize: font.size.sm, color: colors.textPrimary, marginBottom: spacing.sm }}>{f.summary_text}</p>
          <button
            type="button"
            onClick={() => acknowledge(f.id)}
            style={{ fontSize: font.size.xs, color: colors.accent }}
          >
            Segna come visto
          </button>
        </div>
      ))}
    </div>
  );
}
