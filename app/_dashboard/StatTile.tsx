// ============================================================
// IterUp — stat tile (dashboard)
// ------------------------------------------------------------
// label (sentence case, no trailing colon) · value (semibold,
// proporzionale, non tabular — vedi dataviz marks-and-anatomy.md) ·
// sublabel opzionale.
// ============================================================

import { colors, spacing, radius, font } from "@/lib/design-tokens";

interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
}

export default function StatTile({ label, value, sublabel, accent }: StatTileProps) {
  return (
    <div
      style={{
        backgroundColor: colors.surfaceAlt,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
      }}
    >
      <span style={{ fontSize: font.size.xs, color: colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: font.size.xl, fontWeight: font.weight.semibold, color: accent ?? colors.textPrimary }}>
        {value}
      </span>
      {sublabel && <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>{sublabel}</span>}
    </div>
  );
}
