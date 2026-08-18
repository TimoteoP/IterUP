"use client";

// ============================================================
// IterUp — vista cronologica integrata (peso + kcal + attività + abitudini)
// ------------------------------------------------------------
// Vedi PRD-addendum-hardening-completamento.md B3. 4 serie a scale
// molto diverse (kg, %, minuti, conteggio) non possono condividere un
// asse — mai un grafico a doppio/quadruplo asse (vedi dataviz
// anti-patterns.md). Qui: piccoli multipli allineati sulla stessa
// scala temporale (x condiviso), ognuno con la propria scala y, così
// il confronto visivo tra le date resta possibile senza un asse
// bugiardo. SVG scritto a mano, nessuna libreria di charting.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";

interface TimelinePoint {
  date: string;
  weightKg: number | null;
  kcalAdherencePct: number | null;
  habitsCompleted: number;
  habitsActive: number;
  activityMinutes: number;
}

interface TimelineResponse {
  days: number;
  series: TimelinePoint[];
  maxCurrentStreak: number;
}

const WIDTH = 600;
const HEIGHT = 90;
const PAD = { top: 8, right: 8, bottom: 8, left: 8 };
const DAY_OPTIONS = [7, 30, 90] as const;

function formatDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// Mini-grafico a linea con gap: un valore null interrompe la linea
// invece di essere disegnato come zero (vedi B3, "gap visivo, non uno
// zero implicito che falserebbe la lettura").
function MiniLine({ points, color, formatValue }: { points: (number | null)[]; color: string; formatValue: (v: number) => string }) {
  const values = points.filter((v): v is number => v !== null);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const range = max - min || 1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const xFor = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yFor = (v: number) => PAD.top + innerH - ((v - min) / range) * innerH;

  // Spezza il path in segmenti contigui (i gap null interrompono la linea).
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  points.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ x: xFor(i), y: yFor(v) });
    }
  });
  if (current.length > 0) segments.push(current);

  const lastValue = [...points].reverse().find((v) => v !== null);

  if (values.length === 0) {
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: HEIGHT / 2, display: "block" }}>
        <text x={PAD.left} y={HEIGHT / 2} fontSize={11} fill={colors.textMuted}>
          Nessun dato nel periodo
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: HEIGHT / 1.6, display: "block" }}>
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {lastValue !== undefined && lastValue !== null && (
        <text x={WIDTH - PAD.right} y={PAD.top + 10} textAnchor="end" fontSize={11} fill={colors.textPrimary} fontWeight={600}>
          {formatValue(lastValue)}
        </text>
      )}
    </svg>
  );
}

// Mini-grafico a barre: uno zero qui è un valore vero, mai un gap.
function MiniBars({ points, color, max }: { points: number[]; color: string; max: number }) {
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const n = points.length;
  const barW = Math.max(1, Math.min(14, innerW / n - 2));
  const safeMax = max || 1;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: HEIGHT / 1.6, display: "block" }}>
      {points.map((v, i) => {
        const x = PAD.left + (i / n) * innerW;
        const h = Math.max(1, (v / safeMax) * innerH);
        return (
          <rect
            key={i}
            x={x}
            y={PAD.top + innerH - h}
            width={barW}
            height={h}
            rx={2}
            fill={color}
            opacity={v === 0 ? 0.15 : 0.85}
          />
        );
      })}
    </svg>
  );
}

function Row({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span style={{ fontSize: font.size.sm, color: colors.textSecondary }}>{label}</span>
        {sublabel && <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>{sublabel}</span>}
      </div>
      {children}
    </div>
  );
}

export default function UnifiedTrendChart() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/timeline?days=${days}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Errore sconosciuto"));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const { weightPoints, kcalPoints, habitsPoints, minutesPoints, maxHabits, maxMinutes, firstDate, lastDate } = useMemo(() => {
    const series = data?.series ?? [];
    return {
      weightPoints: series.map((p) => p.weightKg),
      kcalPoints: series.map((p) => p.kcalAdherencePct),
      habitsPoints: series.map((p) => p.habitsCompleted),
      minutesPoints: series.map((p) => p.activityMinutes),
      maxHabits: Math.max(1, ...series.map((p) => p.habitsActive)),
      maxMinutes: Math.max(1, ...series.map((p) => p.activityMinutes)),
      firstDate: series[0]?.date,
      lastDate: series[series.length - 1]?.date,
    };
  }, [data]);

  return (
    <div>
      {/* Filtro range: una riga sopra i grafici, preset invece di un date picker libero */}
      <div className="flex items-center justify-between" style={{ marginBottom: spacing.md }}>
        <div className="flex" style={{ gap: spacing.xs }}>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: `2px ${spacing.sm}`,
                borderRadius: radius.full,
                fontSize: font.size.xs,
                fontWeight: font.weight.medium,
                backgroundColor: days === d ? colors.primary : colors.surfaceAlt,
                color: days === d ? colors.background : colors.textSecondary,
                border: `1px solid ${days === d ? colors.primary : colors.border}`,
              }}
            >
              {d}g
            </button>
          ))}
        </div>
        {firstDate && lastDate && (
          <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>
            {formatDateShort(firstDate)} – {formatDateShort(lastDate)}
          </span>
        )}
      </div>

      {error && <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>}

      {!data && !error && <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>}

      {data && (
        <div className="flex flex-col" style={{ gap: spacing.md }}>
          <Row label="Peso">
            <MiniLine points={weightPoints} color={colors.primary} formatValue={(v) => `${v} kg`} />
          </Row>
          <Row label="Aderenza kcal (% del target)">
            <MiniLine points={kcalPoints} color={colors.macro.kcal} formatValue={(v) => `${v}%`} />
          </Row>
          <Row label="Abitudini completate" sublabel={`streak più lunga in corso: ${data.maxCurrentStreak}g`}>
            <MiniBars points={habitsPoints} color={colors.macro.protein} max={maxHabits} />
          </Row>
          <Row label="Minuti di attività">
            <MiniBars points={minutesPoints} color={colors.accent} max={maxMinutes} />
          </Row>
        </div>
      )}
    </div>
  );
}
