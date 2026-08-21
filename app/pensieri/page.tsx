"use client";

// ============================================================
// IterUp — Pensieri (Negative Self-Talk & Cognitive Reframing)
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md. Cattura rapida sempre in
// cima (sezione 5: "requisito UX più critico"), pattern rilevati
// subito visibili sopra, storico sotto; l'analisi vive in una tab
// separata per non appesantire la vista principale.
// ============================================================

import { useRef, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import QuickCaptureForm from "./QuickCaptureForm";
import EntriesList, { type EntriesListHandle } from "./EntriesList";
import PatternFlagsPanel from "./PatternFlagsPanel";
import AnalyticsPanel from "./AnalyticsPanel";

type Tab = "pensieri" | "analisi";

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

export default function PensieriPage() {
  const [tab, setTab] = useState<Tab>("pensieri");
  const entriesRef = useRef<EntriesListHandle>(null);

  return (
    <main className="min-h-screen w-full" style={{ backgroundColor: colors.background, color: colors.textPrimary }}>
      <div className="mx-auto flex max-w-2xl flex-col" style={{ padding: spacing.lg, gap: spacing.lg }}>
        <header>
          <h1 style={{ fontSize: font.size.xl, fontWeight: font.weight.bold }}>Pensieri</h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            Registra un pensiero negativo e, quando vuoi, lavoraci sopra con un thought record guidato.
          </p>
        </header>

        <div
          className="inline-flex"
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.full,
            padding: 4,
            gap: 4,
            backgroundColor: colors.surfaceAlt,
            alignSelf: "flex-start",
          }}
        >
          {(
            [
              ["pensieri", "Pensieri"],
              ["analisi", "Analisi"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                padding: `${spacing.xs} ${spacing.md}`,
                borderRadius: radius.full,
                fontSize: font.size.sm,
                fontWeight: font.weight.medium,
                backgroundColor: tab === value ? colors.primary : "transparent",
                color: tab === value ? colors.background : colors.textSecondary,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pensieri" ? (
          <>
            <section style={cardStyle}>
              <PatternFlagsPanel />
            </section>

            <section style={cardStyle}>
              <QuickCaptureForm onCreated={() => entriesRef.current?.reload()} />
            </section>

            <section style={cardStyle}>
              <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
                Storico
              </h2>
              <EntriesList ref={entriesRef} />
            </section>
          </>
        ) : (
          <section style={cardStyle}>
            <AnalyticsPanel />
          </section>
        )}
      </div>
    </main>
  );
}
