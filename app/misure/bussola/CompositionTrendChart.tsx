"use client";

// ============================================================
// IterUp — Bussola: trend FM/FFM/peso nel tempo
// ------------------------------------------------------------
// 3 serie -> legenda sempre presente (colore segue l'entità, ordine
// categoriale fisso), un solo tooltip con tutte le serie al passaggio
// (vedi dataviz interaction.md "One tooltip, every series"). Colori
// riusati dalla palette macro già esistente in IterUp (proteine per
// massa magra, grassi per massa grassa — nessuna palette nuova).
// ============================================================

import { useMemo, useRef, useState } from "react";
import { colors, font, spacing } from "@/lib/design-tokens";

interface CheckinPoint {
  date: string;
  weightKg: number;
  fm: number;
  ffm: number;
}

interface CompositionTrendChartProps {
  history: CheckinPoint[];
}

const WIDTH = 600;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 24, left: 36 };

const SERIES = [
  { key: "ffm" as const, label: "Massa magra (FFM)", color: colors.macro.protein },
  { key: "fm" as const, label: "Massa grassa (FM)", color: colors.macro.fat },
  { key: "weightKg" as const, label: "Peso", color: colors.accent },
];

function formatDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function CompositionTrendChart({ history }: CompositionTrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { xFor, yFor, minY, maxY } = useMemo(() => {
    const allValues = history.flatMap((h) => [h.weightKg, h.fm, h.ffm]);
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const margin = Math.max((rawMax - rawMin) * 0.15, 1);
    const minY = rawMin - margin;
    const maxY = rawMax + margin;

    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const xFor = (i: number) => PAD.left + (history.length === 1 ? innerW / 2 : (i / (history.length - 1)) * innerW);
    const yFor = (v: number) => PAD.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

    return { xFor, yFor, minY, maxY };
  }, [history]);

  if (history.length === 0) {
    return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Nessun check-in registrato ancora.</p>;
  }

  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const gridLines = [minY, minY + (maxY - minY) / 2, maxY];

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;
    let nearest = 0;
    let nearestDist = Infinity;
    history.forEach((_, i) => {
      const d = Math.abs(xFor(i) - localX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hover = hoverIndex !== null ? history[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? xFor(hoverIndex) : 0;

  return (
    <div>
      {/* Legenda */}
      <div className="flex flex-wrap" style={{ gap: spacing.md, marginBottom: spacing.sm }}>
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center" style={{ gap: 6 }}>
            <span style={{ width: 12, height: 2, backgroundColor: s.color, display: "inline-block" }} />
            <span style={{ fontSize: font.size.xs, color: colors.textSecondary }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {gridLines.map((v, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(v)} y2={yFor(v)} stroke={colors.border} strokeWidth={1} />
              <text x={PAD.left - 6} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={colors.textMuted}>
                {Math.round(v)}
              </text>
            </g>
          ))}

          {SERIES.map((s) => {
            const d = history.map((h, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(h[s.key])}`).join(" ");
            return <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
          })}

          {hover && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.textMuted} strokeWidth={1} />
              {SERIES.map((s) => (
                <circle key={s.key} cx={hoverX} cy={yFor(hover[s.key])} r={4} fill={s.color} stroke={colors.surface} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>

        {hover && (
          <div
            style={{
              position: "absolute",
              left: `${(hoverX / WIDTH) * 100}%`,
              top: 0,
              transform: hoverX > WIDTH * 0.7 ? "translateX(-100%)" : "translateX(8px)",
              backgroundColor: colors.surfaceAlt,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              padding: `${spacing.xs} ${spacing.sm}`,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontSize: font.size.xs, color: colors.textMuted, marginBottom: 2 }}>{formatDateShort(hover.date)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between" style={{ gap: spacing.sm, fontSize: font.size.xs }}>
                <span className="flex items-center" style={{ gap: 4, color: colors.textSecondary }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color, display: "inline-block" }} />
                  {s.label}
                </span>
                <span style={{ color: colors.textPrimary, fontWeight: font.weight.semibold }}>
                  {hover[s.key].toFixed(1)} kg
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
