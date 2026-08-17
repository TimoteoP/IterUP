// ============================================================
// IterUp — meter streak abitudine (dashboard)
// ------------------------------------------------------------
// Meter: il fill (colors.primary) porta il progresso, il track è uno
// step più chiaro della stessa rampa (colors.primaryMuted) così lo
// stato si legge sull'intera barra — vedi dataviz
// marks-and-anatomy.md "Figures".
// ============================================================

import { colors, spacing, radius, font } from "@/lib/design-tokens";

interface HabitStreakCardProps {
  name: string;
  streakDays: number;
  acquiredTargetDays: number;
  pctToAcquired: number;
  completedToday: boolean;
}

export default function HabitStreakCard({
  name,
  streakDays,
  acquiredTargetDays,
  pctToAcquired,
  completedToday,
}: HabitStreakCardProps) {
  const acquired = pctToAcquired >= 100;
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textPrimary }}>
          {name}
        </span>
        <span style={{ fontSize: font.size.xs, color: completedToday ? colors.primary : colors.textMuted }}>
          {completedToday ? "✓ oggi" : "—"}
        </span>
      </div>

      <div
        style={{
          marginTop: spacing.xs,
          height: 8,
          borderRadius: radius.full,
          backgroundColor: colors.primaryMuted,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pctToAcquired}%`,
            height: "100%",
            backgroundColor: colors.primary,
            borderRadius: radius.full,
          }}
        />
      </div>

      <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.xs }}>
        {acquired
          ? `Abitudine acquisita 🎉 (streak ${streakDays}g)`
          : `Streak: ${streakDays}/${acquiredTargetDays} giorni (${pctToAcquired}%)`}
      </p>
    </div>
  );
}
