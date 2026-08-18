"use client";

// ============================================================
// IterUp — switch on/off per categoria di nudge (Impostazioni)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 3.1: switch
// "immediato e visibile, non nascosto in sottomenu".
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";

interface Preference {
  trigger_type: string;
  label: string;
  description: string;
  enabled: boolean;
  satisfaction_score: number | null;
}

export default function CoachPreferences() {
  const [preferences, setPreferences] = useState<Preference[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/coach/preferences")
      .then((res) => res.json())
      .then((json) => setPreferences(json.preferences ?? []))
      .catch(() => setError("Errore nel caricamento delle preferenze"));
  }, []);

  async function toggle(triggerType: string, enabled: boolean) {
    setSavingType(triggerType);
    setPreferences((prev) => prev?.map((p) => (p.trigger_type === triggerType ? { ...p, enabled } : p)) ?? prev);
    try {
      const res = await apiFetch("/api/coach/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_type: triggerType, enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Errore nel salvataggio: riprova.");
      setPreferences((prev) => prev?.map((p) => (p.trigger_type === triggerType ? { ...p, enabled: !enabled } : p)) ?? prev);
    } finally {
      setSavingType(null);
    }
  }

  if (error) return <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>;
  if (preferences === null) return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;

  return (
    <div className="flex flex-col" style={{ gap: spacing.sm }}>
      {preferences.map((p) => (
        <div
          key={p.trigger_type}
          className="flex items-center justify-between"
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            opacity: savingType === p.trigger_type ? 0.6 : 1,
          }}
        >
          <div>
            <p style={{ fontSize: font.size.sm, color: colors.textPrimary, fontWeight: font.weight.semibold }}>{p.label}</p>
            <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>{p.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={p.enabled}
            disabled={savingType === p.trigger_type}
            onClick={() => toggle(p.trigger_type, !p.enabled)}
            style={{
              width: 44,
              height: 24,
              borderRadius: radius.full,
              backgroundColor: p.enabled ? colors.primary : colors.border,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: p.enabled ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: radius.full,
                backgroundColor: colors.background,
                transition: "left 0.15s",
              }}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
