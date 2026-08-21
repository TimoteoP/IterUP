"use client";

// ============================================================
// IterUp — Pensieri: dashboard analitica
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 7. Liste/barre
// semplici invece di grafici SVG dedicati (nessuna libreria di
// charting esterna, vedi CLAUDE.md) — sufficiente per la quantità di
// dati di un singolo utente.
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";
import { distortionLabel, themeLabel } from "@/lib/self-talk-taxonomy";

interface DashboardData {
  distortionDistribution: Record<string, number>;
  themeDistribution: Record<string, number>;
  moodTrend: { date: string; moodBefore: number; moodAfter: number }[];
  divergenceTrend: { month: string; entriesWithBothSources: number; agreementPct: number }[];
}

function BarList({ data, labelFor }: { data: Record<string, number>; labelFor: (k: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>Nessun dato ancora.</p>;
  }
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="flex flex-col" style={{ gap: spacing.xs }}>
      {entries.map(([key, count]) => (
        <div key={key} className="flex items-center" style={{ gap: spacing.sm }}>
          <span style={{ fontSize: font.size.xs, color: colors.textSecondary, width: 160, flexShrink: 0 }}>{labelFor(key)}</span>
          <div style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.full, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${(count / max) * 100}%`, height: "100%", backgroundColor: colors.primary }} />
          </div>
          <span style={{ fontSize: font.size.xs, color: colors.textMuted, width: 24, textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/self-talk/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setError("Errore nel caricamento dell'analisi"));
  }, []);

  if (error) return <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>;
  if (!data) return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;

  const avgDelta =
    data.moodTrend.length > 0
      ? data.moodTrend.reduce((s, m) => s + (m.moodAfter - m.moodBefore), 0) / data.moodTrend.length
      : null;

  return (
    <div className="flex flex-col" style={{ gap: spacing.lg }}>
      <div>
        <h3 style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, marginBottom: spacing.sm }}>
          Distorsioni più frequenti (90 giorni)
        </h3>
        <BarList data={data.distortionDistribution} labelFor={distortionLabel} />
      </div>

      <div>
        <h3 style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, marginBottom: spacing.sm }}>
          Temi ricorrenti (30 giorni)
        </h3>
        <BarList data={data.themeDistribution} labelFor={themeLabel} />
      </div>

      <div>
        <h3 style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, marginBottom: spacing.sm }}>
          Effetto del reframe sull&apos;umore
        </h3>
        {avgDelta === null ? (
          <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>Nessuna sessione completata ancora.</p>
        ) : (
          <p style={{ fontSize: font.size.sm, color: colors.textPrimary }}>
            In media, l&apos;umore cambia di{" "}
            <strong style={{ color: avgDelta > 0 ? colors.primary : colors.textPrimary }}>
              {avgDelta > 0 ? "+" : ""}
              {avgDelta.toFixed(1)}
            </strong>{" "}
            punti dopo un reframe, su {data.moodTrend.length} session{data.moodTrend.length === 1 ? "e" : "i"} completat
            {data.moodTrend.length === 1 ? "a" : "e"}.
          </p>
        )}
      </div>

      {data.divergenceTrend.length > 0 && (
        <div>
          <h3 style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, marginBottom: spacing.sm }}>
            Quanto la tua auto-percezione coincide con l&apos;AI
          </h3>
          <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginBottom: spacing.sm }}>
            Percentuale di pensieri in cui il tag che hai scelto tu coincide con quello suggerito dall&apos;AI.
          </p>
          <div className="flex flex-col" style={{ gap: spacing.xs }}>
            {data.divergenceTrend.map((d) => (
              <div key={d.month} className="flex items-center justify-between" style={{ fontSize: font.size.xs, color: colors.textSecondary }}>
                <span>{d.month}</span>
                <span>
                  {d.agreementPct}% ({d.entriesWithBothSources} pensier{d.entriesWithBothSources === 1 ? "o" : "i"})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
