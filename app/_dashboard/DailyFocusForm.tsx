"use client";

// ============================================================
// IterUp — form "priorità della giornata" (dashboard)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 4: le 3
// priorità lette dal rituale mattutino, se compilate. Se lasciate
// vuote l'endpoint /api/coach/morning le deduce da goal/abitudini.
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";

export default function DailyFocusForm() {
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/coach/daily-focus")
      .then((res) => res.json())
      .then((json) => {
        const f = json.dailyFocus;
        if (f) setPriorities([f.priority_1 ?? "", f.priority_2 ?? "", f.priority_3 ?? ""]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/coach/daily-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority_1: priorities[0], priority_2: priorities[1], priority_3: priorities[2] }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;

  return (
    <div className="flex flex-col" style={{ gap: spacing.xs }}>
      {priorities.map((value, i) => (
        <input
          key={i}
          type="text"
          value={value}
          placeholder={`Priorità ${i + 1}`}
          onChange={(e) => {
            const next = [...priorities];
            next[i] = e.target.value;
            setPriorities(next);
            setSaved(false);
          }}
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
          }}
        />
      ))}
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
          {saving ? "Salvataggio…" : "Salva priorità"}
        </button>
        {saved && <span style={{ fontSize: font.size.xs, color: colors.primary }}>Salvato.</span>}
      </div>
    </div>
  );
}
