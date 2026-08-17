"use client";

// ============================================================
// IterUp — Dashboard (home page)
// ------------------------------------------------------------
// Panoramica di tutti i moduli attivi: peso/trend verso l'obiettivo
// con grafico, target macro di oggi, streak abitudini, passi/
// allenamenti, obiettivi in corso. Sola lettura, dati da
// GET /api/dashboard.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import MacroProgressBar from "../diario/MacroProgressBar";
import WeightChart from "./WeightChart";
import StatTile from "./StatTile";
import HabitStreakCard from "./HabitStreakCard";

interface DashboardData {
  profile: { fullName: string | null; dietaryRegimeLabel: string };
  target: { modeLabel: string; dailyKcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  todayMacros: {
    consumed: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
    target: { daily_kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  };
  weight: {
    current: number | null;
    goal: number | null;
    kgToGoal: number | null;
    trendKgPerWeek: number | null;
    weeksToGoal: number | null;
    estimatedDate: string | null;
    history: { date: string; weightKg: number }[];
  };
  habits: {
    id: string;
    name: string;
    kind: string;
    streakDays: number;
    acquiredTargetDays: number;
    pctToAcquired: number;
    completedToday: boolean;
  }[];
  activity: {
    stepsToday: number;
    stepsWeek: number;
    stepsMonth: number;
    workoutsWeek: number;
    workoutMinutesWeek: number;
  };
  goals: {
    id: string;
    title: string;
    goalType: string;
    targetValue: number | null;
    targetDate: string | null;
    progressPct: number | null;
  }[];
}

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  marginBottom: spacing.md,
};

function formatDateLong(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento della dashboard");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <main style={{ backgroundColor: colors.background, minHeight: "100vh", padding: spacing.lg }}>
        <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ backgroundColor: colors.background, minHeight: "100vh", padding: spacing.lg }}>
        <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>
      </main>
    );
  }

  const { profile, target, todayMacros, weight, habits, activity, goals } = data;

  return (
    <main className="min-h-screen w-full" style={{ backgroundColor: colors.background, color: colors.textPrimary }}>
      <div className="mx-auto flex max-w-3xl flex-col" style={{ padding: spacing.lg, gap: spacing.lg }}>
        <header>
          <h1 style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold }}>
            Ciao{profile.fullName ? `, ${profile.fullName}` : ""}
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            {formatDateLong(new Date().toISOString().slice(0, 10))}
            {target ? ` · ${target.modeLabel} · ${profile.dietaryRegimeLabel}` : ""}
          </p>
        </header>

        {/* Peso */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Peso</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <StatTile label="Peso attuale" value={weight.current !== null ? `${weight.current} kg` : "—"} />
            <StatTile label="Obiettivo" value={weight.goal !== null ? `${weight.goal} kg` : "Non impostato"} />
            <StatTile
              label="Mancano"
              value={weight.kgToGoal !== null ? `${Math.abs(weight.kgToGoal)} kg` : "—"}
              sublabel={
                weight.kgToGoal !== null
                  ? weight.kgToGoal > 0
                    ? "da perdere"
                    : weight.kgToGoal < 0
                      ? "da guadagnare"
                      : "raggiunto!"
                  : undefined
              }
              accent={weight.kgToGoal === 0 ? colors.primary : undefined}
            />
            <StatTile
              label="Trend"
              value={weight.trendKgPerWeek !== null ? `${weight.trendKgPerWeek > 0 ? "+" : ""}${weight.trendKgPerWeek} kg/sett.` : "—"}
              sublabel={
                weight.weeksToGoal !== null && weight.estimatedDate
                  ? `${weight.weeksToGoal} settimane (${formatDateLong(weight.estimatedDate)})`
                  : weight.goal !== null
                    ? "trend non favorevole all'obiettivo"
                    : undefined
              }
            />
          </div>
          <WeightChart history={weight.history} goal={weight.goal} />
        </section>

        {/* Target di oggi */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Target di oggi</h2>
          {target ? (
            <div className="flex flex-col" style={{ gap: spacing.md }}>
              <MacroProgressBar
                label="Calorie"
                unit="kcal"
                consumed={todayMacros.consumed.kcal}
                target={target.dailyKcal}
                color={colors.macro.kcal}
              />
              <MacroProgressBar
                label="Proteine"
                unit="g"
                consumed={todayMacros.consumed.protein_g}
                target={target.proteinG}
                color={colors.macro.protein}
              />
              <MacroProgressBar
                label="Carboidrati"
                unit="g"
                consumed={todayMacros.consumed.carbs_g}
                target={target.carbsG}
                color={colors.macro.carbs}
              />
              <MacroProgressBar
                label="Grassi"
                unit="g"
                consumed={todayMacros.consumed.fat_g}
                target={target.fatG}
                color={colors.macro.fat}
              />
              <Link href="/diario" style={{ fontSize: font.size.xs, color: colors.accent }}>
                Vai al diario →
              </Link>
            </div>
          ) : (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Nessun target attivo.{" "}
              <Link href="/impostazioni" style={{ color: colors.accent }}>
                Completa il profilo
              </Link>
              .
            </p>
          )}
        </section>

        {/* Abitudini */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Abitudini</h2>
          {habits.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Nessuna abitudine attiva.{" "}
              <Link href="/abitudini" style={{ color: colors.accent }}>
                Aggiungine una
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: spacing.sm }}>
              {habits.map((h) => (
                <HabitStreakCard
                  key={h.id}
                  name={h.name}
                  streakDays={h.streakDays}
                  acquiredTargetDays={h.acquiredTargetDays}
                  pctToAcquired={h.pctToAcquired}
                  completedToday={h.completedToday}
                />
              ))}
            </div>
          )}
        </section>

        {/* Attività */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Attività</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: spacing.sm }}>
            <StatTile label="Passi oggi" value={activity.stepsToday.toLocaleString("it-IT")} />
            <StatTile label="Passi settimana" value={activity.stepsWeek.toLocaleString("it-IT")} />
            <StatTile label="Passi mese" value={activity.stepsMonth.toLocaleString("it-IT")} />
            <StatTile
              label="Allenamenti sett."
              value={String(activity.workoutsWeek)}
              sublabel={activity.workoutMinutesWeek > 0 ? `${activity.workoutMinutesWeek} min totali` : undefined}
            />
          </div>
        </section>

        {/* Obiettivi in corso */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Obiettivi in corso</h2>
          {goals.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Nessun obiettivo in corso.{" "}
              <Link href="/obiettivi" style={{ color: colors.accent }}>
                Creane uno
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col" style={{ gap: spacing.sm }}>
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: font.size.sm, color: colors.textPrimary }}>{g.title}</span>
                    <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                      {g.targetDate ? formatDateLong(g.targetDate) : ""}
                    </span>
                  </div>
                  {g.progressPct !== null && (
                    <div
                      style={{
                        marginTop: spacing.xs,
                        height: 6,
                        borderRadius: radius.full,
                        backgroundColor: colors.primaryMuted,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${g.progressPct}%`,
                          height: "100%",
                          backgroundColor: colors.primary,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
              <Link href="/obiettivi" style={{ fontSize: font.size.xs, color: colors.accent }}>
                Vedi tutti gli obiettivi →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
