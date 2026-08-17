// ============================================================
// IterUp — Bussola: breakdown numerico
// ------------------------------------------------------------
// Sempre visibile e non collassabile sotto la bussola (requisito di
// trasparenza esplicito, vedi PRD-addendum-bussola-ricomposizione
// sezione 6): bilancio kcal periodo, Δpeso atteso, Δpeso reale, IR,
// correzione soggettiva.
// ============================================================

import { colors, spacing, radius, font } from "@/lib/design-tokens";

interface BreakdownProps {
  latest: {
    days: number;
    weightNow: number;
    weightPrev: number;
    fmNow: number;
    fmPrev: number;
    ffmNow: number;
    ffmPrev: number;
    energy: { kcalPeriod: number; maintenancePeriod: number; balance: number; expectedDeltaWeightKg: number } | null;
    recomposition: { irRaw: number; qualNudge: number; compScoreRaw: number };
    warnings: { shortInterval: boolean; missingEnergyData: boolean };
  };
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signed(n: number, digits = 1): string {
  const s = fmt(Math.abs(n), digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: `${spacing.xs} 0`,
  borderTop: `1px solid ${colors.border}`,
  fontSize: font.size.sm,
};

export default function Breakdown({ latest }: BreakdownProps) {
  const realDeltaWeight = latest.weightNow - latest.weightPrev;

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
        Confronto con il check-in precedente ({latest.days} {latest.days === 1 ? "giorno fa" : "giorni fa"})
      </p>

      {latest.warnings.shortInterval && (
        <p style={{ fontSize: font.size.xs, color: colors.warning, marginBottom: spacing.sm }}>
          Intervallo breve (&lt; 3 giorni): il segnale può essere rumoroso per fluttuazioni idriche.
        </p>
      )}

      <div>
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Bilancio kcal periodo</span>
          <span style={{ color: colors.textPrimary, fontWeight: font.weight.medium }}>
            {latest.energy ? `${signed(latest.energy.balance, 0)} kcal` : "n.d."}
          </span>
        </div>
        {latest.warnings.missingEnergyData && (
          <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 }}>
            kcal periodo non inserite nell&apos;ultimo check-in: direzione calcolata solo sull&apos;asse composizione.
          </p>
        )}
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Δ peso atteso (dal bilancio kcal)</span>
          <span style={{ color: colors.textPrimary }}>
            {latest.energy ? `${signed(latest.energy.expectedDeltaWeightKg, 2)} kg` : "n.d."}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Δ peso reale</span>
          <span style={{ color: colors.textPrimary }}>{signed(realDeltaWeight, 2)} kg</span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Massa grassa (FM)</span>
          <span style={{ color: colors.textPrimary }}>
            {fmt(latest.fmPrev)} → {fmt(latest.fmNow)} kg ({signed(latest.fmNow - latest.fmPrev, 2)})
          </span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Massa magra (FFM)</span>
          <span style={{ color: colors.textPrimary }}>
            {fmt(latest.ffmPrev)} → {fmt(latest.ffmNow)} kg ({signed(latest.ffmNow - latest.ffmPrev, 2)})
          </span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Indice di Ricomposizione (IR)</span>
          <span style={{ color: colors.textPrimary }}>{signed(latest.recomposition.irRaw, 2)}</span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: colors.textSecondary }}>Correzione soggettiva (collo/polso)</span>
          <span style={{ color: colors.textPrimary }}>{signed(latest.recomposition.qualNudge, 2)}</span>
        </div>
      </div>
    </div>
  );
}
