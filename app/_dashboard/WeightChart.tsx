"use client";

// ============================================================
// IterUp — grafico peso nel tempo (dashboard)
// ------------------------------------------------------------
// Linea singola (nessuna legenda necessaria, il titolo la nomina),
// 2px, crosshair+tooltip al passaggio del mouse, linea tratteggiata
// per l'obiettivo se impostato. Segue references/marks-and-anatomy.md
// e interaction.md della skill dataviz: hairline gridlines, area fill
// ~10% opacità, marker di fine ≥8px con anello 2px colore superficie.
// ============================================================

import { useMemo, useRef, useState } from "react";
import { colors, font, spacing } from "@/lib/design-tokens";

interface WeightPoint {
  date: string;
  weightKg: number;
}

interface WeightChartProps {
  history: WeightPoint[];
  goal: number | null;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 24, left: 40 };

function formatDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function WeightChart({ history, goal }: WeightChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, minY, maxY } = useMemo(() => {
    if (history.length === 0) return { points: [] as { x: number; y: number; date: string; weightKg: number }[], minY: 0, maxY: 1 };

    const values = history.map((h) => h.weightKg);
    const goalValues = goal !== null ? [...values, goal] : values;
    const rawMin = Math.min(...goalValues);
    const rawMax = Math.max(...goalValues);
    const margin = Math.max((rawMax - rawMin) * 0.15, 1);
    const minY = rawMin - margin;
    const maxY = rawMax + margin;

    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const points = history.map((h, i) => {
      const x = PAD.left + (history.length === 1 ? innerW / 2 : (i / (history.length - 1)) * innerW);
      const y = PAD.top + innerH - ((h.weightKg - minY) / (maxY - minY)) * innerH;
      return { x, y, date: h.date, weightKg: h.weightKg };
    });

    return { points, minY, maxY };
  }, [history, goal]);

  if (history.length === 0) {
    return (
      <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
        Nessuna misurazione registrata ancora.
      </p>
    );
  }

  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const yForValue = (v: number) => PAD.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${points[0].x} ${PAD.top + innerH} Z`;

  const gridLines = [minY, minY + (maxY - minY) / 2, maxY];

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - localX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hover = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Gridlines: hairline, recessive */}
        {gridLines.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yForValue(v)}
              y2={yForValue(v)}
              stroke={colors.border}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yForValue(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={colors.textMuted}
            >
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Linea obiettivo, tratteggiata */}
        {goal !== null && (
          <g>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yForValue(goal)}
              y2={yForValue(goal)}
              stroke={colors.accent}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={WIDTH - PAD.right} y={yForValue(goal) - 4} textAnchor="end" fontSize={10} fill={colors.accent}>
              Obiettivo {goal}kg
            </text>
          </g>
        )}

        {/* Area fill ~10% opacità */}
        <path d={areaPath} fill={colors.primary} opacity={0.1} stroke="none" />

        {/* Linea, 2px, round join/cap */}
        <path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Marker di fine, >=8px, anello colore superficie */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={5} fill={colors.primary} stroke={colors.surface} strokeWidth={2} />

        {/* Crosshair + hover point */}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.textMuted} strokeWidth={1} />
            <circle cx={hover.x} cy={hover.y} r={5} fill={colors.primary} stroke={colors.surface} strokeWidth={2} />
          </g>
        )}
      </svg>

      {hover && (
        <div
          style={{
            position: "absolute",
            left: `${(hover.x / WIDTH) * 100}%`,
            top: 0,
            transform: hover.x > WIDTH * 0.7 ? "translateX(-100%)" : "translateX(8px)",
            backgroundColor: colors.surfaceAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: `${spacing.xs} ${spacing.sm}`,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textPrimary }}>
            {hover.weightKg} kg
          </div>
          <div style={{ fontSize: font.size.xs, color: colors.textMuted }}>{formatDateShort(hover.date)}</div>
        </div>
      )}
    </div>
  );
}
