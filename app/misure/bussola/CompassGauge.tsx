"use client";

// ============================================================
// IterUp — Bussola di Ricomposizione: quadrante ad ago
// ------------------------------------------------------------
// SVG leggero (non canvas), vedi PRD-addendum-bussola-ricomposizione
// sezione 6: cerchio, assi Nord/Sud (massa magra su/giù) ed
// Est/Ovest (deficit/surplus), ago con punta. Colore dell'ago per
// stato (buono/neutro/attenzione), coerente con la palette esistente
// — non introduce una nuova scala colori.
// ============================================================

import { colors } from "@/lib/design-tokens";
import type { DirectionZone } from "@/lib/composition";

interface CompassGaugeProps {
  /** -1 (deficit) .. +1 (surplus) */
  energyScore: number;
  /** -1 (perdita massa magra) .. +1 (guadagno massa magra) */
  compScore: number;
  zone: DirectionZone;
  isWarning: boolean;
}

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 32;

const ZONE_COLOR: Record<DirectionZone, string> = {
  ricomposizione_ideale: colors.primary,
  bulk_pulito: colors.primary,
  mantenimento_stabile: colors.textSecondary,
  accumulo_grasso: colors.warning,
  perdita_muscolare: colors.danger,
  ambigua: colors.textMuted,
};

export default function CompassGauge({ energyScore, compScore, zone, isWarning }: CompassGaugeProps) {
  const needleColor = ZONE_COLOR[zone];
  const tipX = CENTER + energyScore * RADIUS;
  const tipY = CENTER - compScore * RADIUS;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", maxWidth: 280, height: "auto", display: "block", margin: "0 auto" }}>
      {/* Quadranti (wash leggerissimo) */}
      <rect x={CENTER} y={0} width={RADIUS} height={RADIUS} fill={colors.primary} opacity={0.04} />
      <rect x={CENTER - RADIUS} y={0} width={RADIUS} height={RADIUS} fill={colors.primary} opacity={0.04} />
      <rect x={CENTER} y={CENTER} width={RADIUS} height={RADIUS} fill={colors.warning} opacity={0.04} />
      <rect x={CENTER - RADIUS} y={CENTER} width={RADIUS} height={RADIUS} fill={colors.danger} opacity={0.04} />

      {/* Cerchio esterno */}
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={colors.border} strokeWidth={1} />
      <circle cx={CENTER} cy={CENTER} r={RADIUS / 2} fill="none" stroke={colors.border} strokeWidth={1} strokeDasharray="2 3" />

      {/* Assi */}
      <line x1={CENTER - RADIUS} y1={CENTER} x2={CENTER + RADIUS} y2={CENTER} stroke={colors.border} strokeWidth={1} />
      <line x1={CENTER} y1={CENTER - RADIUS} x2={CENTER} y2={CENTER + RADIUS} stroke={colors.border} strokeWidth={1} />

      {/* Etichette assi */}
      <text x={CENTER} y={16} textAnchor="middle" fontSize={9} fill={colors.textMuted}>↑ massa magra</text>
      <text x={CENTER} y={SIZE - 8} textAnchor="middle" fontSize={9} fill={colors.textMuted}>↓ massa magra</text>
      <text x={8} y={CENTER + 3} textAnchor="start" fontSize={9} fill={colors.textMuted}>deficit</text>
      <text x={SIZE - 8} y={CENTER + 3} textAnchor="end" fontSize={9} fill={colors.textMuted}>surplus</text>

      {/* Ago */}
      <line x1={CENTER} y1={CENTER} x2={tipX} y2={tipY} stroke={needleColor} strokeWidth={2} strokeLinecap="round" />
      <circle cx={CENTER} cy={CENTER} r={4} fill={needleColor} stroke={colors.surface} strokeWidth={2} />
      <circle cx={tipX} cy={tipY} r={6} fill={needleColor} stroke={colors.surface} strokeWidth={2} />

      {isWarning && (
        <text x={CENTER} y={CENTER - RADIUS - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill={colors.danger}>
          ⚠
        </text>
      )}
    </svg>
  );
}
