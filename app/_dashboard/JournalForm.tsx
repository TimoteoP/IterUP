"use client";

// ============================================================
// IterUp — form "Note del giorno" (dashboard)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 5: testo libero
// letto (non interpretato clinicamente) dal rituale serale. Nome
// distinto dal diario alimentare per evitare confusione.
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";

export default function JournalForm() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/coach/journal")
      .then((res) => res.json())
      .then((json) => setContent(json.entry?.content ?? ""))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/coach/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;

  return (
    <div className="flex flex-col" style={{ gap: spacing.xs }}>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
        placeholder="Com'è andata oggi? (facoltativo, letto solo dal riepilogo serale)"
        rows={3}
        style={{
          backgroundColor: colors.surfaceAlt,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: font.size.sm,
          resize: "vertical",
        }}
      />
      <div className="flex items-center" style={{ gap: spacing.sm }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: colors.primary,
            color: colors.background,
            borderRadius: radius.md,
            padding: `${spacing.xs} ${spacing.md}`,
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Salvataggio…" : "Salva nota"}
        </button>
        {saved && <span style={{ fontSize: font.size.xs, color: colors.primary }}>Salvato.</span>}
      </div>
    </div>
  );
}
