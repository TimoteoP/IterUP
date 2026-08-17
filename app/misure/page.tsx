"use client";

// ============================================================
// IterUp — /misure: tab "Misure" (storico peso/circonferenze) e
// "Bussola" (Bussola di Ricomposizione Corporea) — vedi
// PRD-addendum-bussola-ricomposizione.md sezione 6 ("vive come nuova
// sezione, non sostituisce la vista misure esistente, la affianca").
// ============================================================

import { useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import MisureTab from "./MisureTab";
import BussolaTab from "./bussola/BussolaTab";

type Tab = "misure" | "bussola";

export default function MisurePage() {
  const [tab, setTab] = useState<Tab>("misure");

  return (
    <div style={{ backgroundColor: colors.background, minHeight: "100vh" }}>
      <div className="mx-auto max-w-3xl" style={{ padding: `${spacing.lg} ${spacing.lg} 0` }}>
        <div
          className="inline-flex"
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.full,
            padding: 4,
            gap: 4,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          {(
            [
              ["misure", "Misure"],
              ["bussola", "Bussola"],
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
      </div>

      {tab === "misure" ? <MisureTab /> : <BussolaTab />}
    </div>
  );
}
