"use client";

// ============================================================
// IterUp — Bussola di Ricomposizione Corporea (tab di /misure)
// ------------------------------------------------------------
// Richiede minimo 2 check-in per attivarsi: prima di allora stato
// vuoto esplicito, niente bussola disegnata a metà con dati finti —
// vedi PRD-addendum-bussola-ricomposizione sezione 6.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import CheckinForm from "./CheckinForm";
import CompassGauge from "./CompassGauge";
import Breakdown from "./Breakdown";
import CompositionTrendChart from "./CompositionTrendChart";
import type { DirectionZone } from "@/lib/composition";

interface CompositionData {
  hasProfile: boolean;
  hasEnoughData: boolean;
  checkins: { date: string; weightKg: number; bfPercent: number; fm: number; ffm: number }[];
  latest: {
    days: number;
    weightNow: number;
    weightPrev: number;
    fmNow: number;
    fmPrev: number;
    ffmNow: number;
    ffmPrev: number;
    energy: { kcalPeriod: number; maintenancePeriod: number; balance: number; expectedDeltaWeightKg: number } | null;
    recomposition: { irRaw: number; qualNudge: number; compScoreRaw: number; compScore: number };
    energyScore: number;
    direction: { zone: DirectionZone; label: string; description: string; isWarning: boolean };
    warnings: { shortInterval: boolean; missingEnergyData: boolean };
  } | null;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

export default function BussolaTab() {
  const [data, setData] = useState<CompositionData | null>(null);
  const [sex, setSex] = useState<"m" | "f" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [compRes, profileRes] = await Promise.all([fetch("/api/composition"), fetch("/api/profile")]);
      const compJson = await compRes.json();
      const profileJson = await profileRes.json();
      if (!compRes.ok) throw new Error(compJson.error ?? "Errore nel caricamento della bussola");
      setData(compJson);
      setSex(profileJson.profile?.sex ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main className="mx-auto max-w-3xl" style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <header>
        <h1 style={{ fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.textPrimary }}>
          Bussola di Ricomposizione
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
          Direzione della composizione corporea (massa grassa vs magra), incrociata col bilancio energetico —
          non solo il numero sulla bilancia.
        </p>
      </header>

      {error && <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>}

      <section style={cardStyle}>
        <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
          Nuovo check-in
        </h2>
        <CheckinForm sex={sex} onSaved={refresh} />
      </section>

      {!data ? (
        <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>
      ) : !data.hasProfile ? (
        <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
          Completa altezza, sesso, data di nascita e livello di attività in Impostazioni per usare la bussola.
        </p>
      ) : !data.hasEnoughData ? (
        <section style={cardStyle}>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm }}>
            {data.checkins.length === 0
              ? "Registra il primo check-in per stabilire il punto di partenza."
              : "Primo check-in registrato. Registrane un secondo per attivare la bussola e vedere la direzione."}
          </p>
        </section>
      ) : (
        <>
          <section style={cardStyle}>
            <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
              Direzione
            </h2>
            <CompassGauge
              energyScore={data.latest!.energyScore}
              compScore={data.latest!.recomposition.compScore}
              zone={data.latest!.direction.zone}
              isWarning={data.latest!.direction.isWarning}
            />
            <div style={{ textAlign: "center", marginTop: spacing.sm }}>
              <p
                style={{
                  fontSize: font.size.lg,
                  fontWeight: font.weight.semibold,
                  color: data.latest!.direction.isWarning ? colors.danger : colors.textPrimary,
                }}
              >
                {data.latest!.direction.label}
              </p>
              <p style={{ fontSize: font.size.sm, color: colors.textSecondary, marginTop: spacing.xs }}>
                {data.latest!.direction.description}
              </p>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
              Breakdown
            </h2>
            <Breakdown latest={data.latest!} />
            <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.sm }}>
              7700 kcal/kg è un&apos;approssimazione statica (Wishnofsky, 1958): il Δ peso atteso è un riferimento
              direzionale, non una previsione precisa.
            </p>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
              Trend
            </h2>
            <CompositionTrendChart history={data.checkins} />
          </section>
        </>
      )}
    </main>
  );
}
