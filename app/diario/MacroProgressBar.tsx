"use client";

import { colors, radius, font } from "@/lib/design-tokens";

type MacroProgressBarProps = {
  label: string;
  unit: string;
  consumed: number;
  target: number | null;
  color: string;
};

export default function MacroProgressBar({
  label,
  unit,
  consumed,
  target,
  color,
}: MacroProgressBarProps) {
  const pct = target && target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const over = target !== null && consumed > target;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-baseline justify-between"
        style={{ fontSize: font.size.sm, color: colors.textSecondary }}
      >
        <span style={{ color: colors.textPrimary, fontWeight: font.weight.medium }}>
          {label}
        </span>
        <span>
          {Math.round(consumed)}
          {target !== null ? ` / ${Math.round(target)}` : ""} {unit}
        </span>
      </div>
      <div
        className="w-full overflow-hidden"
        style={{
          height: "0.5rem",
          borderRadius: radius.full,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: radius.full,
            backgroundColor: over ? colors.danger : color,
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
}
