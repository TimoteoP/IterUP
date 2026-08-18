"use client";

// ============================================================
// IterUp — card "Il tuo coach oggi" (dashboard)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezione 3.3: ogni nudge
// ha un 👍/👎 rapido + "silenzia questo tipo di messaggio". I nudge
// vengono generati inline dalle route di scrittura esistenti — qui
// si legge solo lo storico recente (GET /api/coach/nudges) e si
// registra la reazione.
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";
import { TRIGGER_LABELS, type CoachTriggerType } from "@/lib/coach-triggers";

interface Nudge {
  id: string;
  trigger_type: string;
  message: string;
  reaction: "like" | "dislike" | "dismissed" | null;
  created_at: string | null;
}

function triggerLabel(triggerType: string): string {
  return TRIGGER_LABELS[triggerType as CoachTriggerType]?.label ?? triggerType;
}

export default function CoachCard() {
  const [nudges, setNudges] = useState<Nudge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/coach/nudges")
      .then((res) => res.json())
      .then((json) => setNudges(json.nudges ?? []))
      .catch(() => setError("Errore nel caricamento dei messaggi del coach"));
  }, []);

  async function react(id: string, reaction: "like" | "dislike" | "dismissed", triggerType?: string) {
    setReactingId(id);
    try {
      const res = await apiFetch(`/api/coach/nudges/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) throw new Error();

      // "Silenzia questo TIPO di messaggio" (vedi addendum 3.3): non
      // è un dismiss del singolo nudge, disattiva l'intera categoria.
      if (reaction === "dismissed" && triggerType) {
        await apiFetch("/api/coach/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_type: triggerType, enabled: false }),
        });
      }

      setNudges((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, reaction } : n)) : prev));
    } catch {
      setError("Errore nel salvataggio della reazione");
    } finally {
      setReactingId(null);
    }
  }

  if (error) {
    return <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>;
  }

  if (nudges === null) {
    return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;
  }

  const pending = nudges.filter((n) => n.reaction === null);

  if (pending.length === 0) {
    return (
      <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
        Nessun nuovo messaggio dal coach al momento.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: spacing.sm }}>
      {pending.map((n) => (
        <div
          key={n.id}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            padding: spacing.sm,
          }}
        >
          <span style={{ fontSize: font.size.xs, color: colors.accent, fontWeight: font.weight.semibold }}>
            {triggerLabel(n.trigger_type)}
          </span>
          <p style={{ fontSize: font.size.sm, color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm }}>
            {n.message}
          </p>
          <div className="flex" style={{ gap: spacing.sm }}>
            <button
              type="button"
              disabled={reactingId === n.id}
              onClick={() => react(n.id, "like")}
              style={{ fontSize: font.size.sm, color: colors.textSecondary, opacity: reactingId === n.id ? 0.5 : 1 }}
            >
              👍
            </button>
            <button
              type="button"
              disabled={reactingId === n.id}
              onClick={() => react(n.id, "dislike")}
              style={{ fontSize: font.size.sm, color: colors.textSecondary, opacity: reactingId === n.id ? 0.5 : 1 }}
            >
              👎
            </button>
            <button
              type="button"
              disabled={reactingId === n.id}
              onClick={() => react(n.id, "dismissed", n.trigger_type)}
              style={{ fontSize: font.size.xs, color: colors.textMuted, opacity: reactingId === n.id ? 0.5 : 1, marginLeft: "auto" }}
              title={`Disattiva i messaggi "${triggerLabel(n.trigger_type)}"`}
            >
              Silenzia questo tipo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
