"use client";

// ============================================================
// IterUp — Attività Fisica (A6)
// ------------------------------------------------------------
// Client component: tutte le letture/scritture passano dalle API route
// (/api/activity/*), che sono le uniche autorizzate a usare la service
// role key (vedi CLAUDE.md regola 3). Nessun accesso diretto a Supabase
// da qui.
//
// Mostra: riepilogo di oggi (passi + allenamenti), form per registrare
// un allenamento manuale, storico ordinato per data decrescente.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import type { Tables } from "@/lib/types";

type ActivityLog = Tables<"activity_logs">;

const WORKOUT_PRESETS = [
  "corsa",
  "camminata",
  "palestra",
  "ciclismo",
  "nuoto",
  "yoga",
  "calcio",
  "altro",
];

function todayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// --- stili condivisi basati sui design token (nessun colore inventato) ---
const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

const labelStyle: React.CSSProperties = {
  color: colors.textSecondary,
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: `${spacing.sm} ${spacing.md}`,
  color: colors.textPrimary,
  fontSize: font.size.md,
  width: "100%",
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: colors.background,
  borderRadius: radius.md,
  padding: `${spacing.sm} ${spacing.lg}`,
  fontWeight: font.weight.semibold,
  fontSize: font.size.md,
  border: "none",
};

export default function AttivitaPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [workoutType, setWorkoutType] = useState(WORKOUT_PRESETS[0]);
  const [customType, setCustomType] = useState("");
  const [minutes, setMinutes] = useState("");
  const [calories, setCalories] = useState("");
  const [recordedAt, setRecordedAt] = useState(todayISODate());

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activity/list?limit=90", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Errore nel caricamento");
      }
      setLogs(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const today = todayISODate();

  const todaySteps = useMemo(
    () => logs.find((l) => l.recorded_at === today && l.workout_type === null),
    [logs, today]
  );

  const todayWorkouts = useMemo(
    () => logs.filter((l) => l.recorded_at === today && l.workout_type !== null),
    [logs, today]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalType =
      workoutType === "altro" ? customType.trim() : workoutType;

    if (!finalType) {
      setError("Specifica il tipo di allenamento");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/activity/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout_type: finalType,
          workout_minutes: minutes ? Number(minutes) : undefined,
          calories_burned: calories ? Number(calories) : undefined,
          recorded_at: recordedAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Errore nel salvataggio");
      }
      setMinutes("");
      setCalories("");
      setCustomType("");
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/activity/delete?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Errore nell'eliminazione");
      }
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    }
  }

  // Raggruppa lo storico per data per una lettura più semplice
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    for (const log of logs) {
      const bucket = map.get(log.recorded_at) ?? [];
      bucket.push(log);
      map.set(log.recorded_at, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [logs]);

  return (
    <main
      style={{
        backgroundColor: colors.background,
        minHeight: "100vh",
        color: colors.textPrimary,
        fontFamily: font.sans,
        padding: spacing.lg,
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: font.size.xxl,
            fontWeight: font.weight.bold,
            marginBottom: spacing.lg,
          }}
        >
          Attività Fisica
        </h1>

        {error && (
          <div
            style={{
              backgroundColor: colors.danger,
              color: colors.background,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
              fontSize: font.size.sm,
            }}
          >
            {error}
          </div>
        )}

        {/* --- Riepilogo oggi --- */}
        <section style={{ ...cardStyle, marginBottom: spacing.lg }}>
          <h2
            style={{
              fontSize: font.size.lg,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Oggi
          </h2>
          <div style={{ display: "flex", gap: spacing.xl, flexWrap: "wrap" }}>
            <div>
              <div style={labelStyle}>Passi</div>
              <div style={{ fontSize: font.size.xl, fontWeight: font.weight.bold }}>
                {todaySteps?.steps ?? "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Allenamenti</div>
              <div style={{ fontSize: font.size.xl, fontWeight: font.weight.bold }}>
                {todayWorkouts.length}
              </div>
            </div>
          </div>
          {todayWorkouts.length > 0 && (
            <ul style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.xs }}>
              {todayWorkouts.map((w) => (
                <li key={w.id} style={{ fontSize: font.size.sm, color: colors.textSecondary }}>
                  {w.workout_type}
                  {w.workout_minutes ? ` · ${w.workout_minutes} min` : ""}
                  {w.calories_burned ? ` · ${w.calories_burned} kcal` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Form nuovo allenamento --- */}
        <section style={{ ...cardStyle, marginBottom: spacing.lg }}>
          <h2
            style={{
              fontSize: font.size.lg,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Registra allenamento
          </h2>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
          >
            <div>
              <label style={labelStyle} htmlFor="workout-type">
                Tipo
              </label>
              <select
                id="workout-type"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                style={{ ...inputStyle, marginTop: spacing.xs }}
              >
                {WORKOUT_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
              {workoutType === "altro" && (
                <input
                  type="text"
                  placeholder="Descrivi il tipo di allenamento"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  style={{ ...inputStyle, marginTop: spacing.sm }}
                />
              )}
            </div>

            <div style={{ display: "flex", gap: spacing.md }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="workout-minutes">
                  Durata (min)
                </label>
                <input
                  id="workout-minutes"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  style={{ ...inputStyle, marginTop: spacing.xs }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="workout-calories">
                  Calorie (opz.)
                </label>
                <input
                  id="workout-calories"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  style={{ ...inputStyle, marginTop: spacing.xs }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="workout-date">
                Data
              </label>
              <input
                id="workout-date"
                type="date"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                max={today}
                style={{ ...inputStyle, marginTop: spacing.xs }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                ...primaryButtonStyle,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "Salvataggio…" : "Salva allenamento"}
            </button>
          </form>
        </section>

        {/* --- Storico --- */}
        <section style={cardStyle}>
          <h2
            style={{
              fontSize: font.size.lg,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Storico
          </h2>

          {loading && (
            <p style={{ color: colors.textSecondary, fontSize: font.size.sm }}>
              Caricamento…
            </p>
          )}

          {!loading && groupedByDate.length === 0 && (
            <p style={{ color: colors.textSecondary, fontSize: font.size.sm }}>
              Nessuna attività registrata.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
            {groupedByDate.map(([date, entries]) => (
              <div key={date}>
                <div
                  style={{
                    fontSize: font.size.sm,
                    color: colors.textMuted,
                    marginBottom: spacing.xs,
                    textTransform: "capitalize",
                  }}
                >
                  {formatDate(date)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.md,
                        padding: `${spacing.sm} ${spacing.md}`,
                      }}
                    >
                      <div style={{ fontSize: font.size.sm }}>
                        {entry.workout_type === null ? (
                          <span>
                            <strong>{entry.steps ?? 0}</strong> passi
                            {entry.source ? (
                              <span style={{ color: colors.textMuted }}> · {entry.source}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span>
                            <strong>{entry.workout_type}</strong>
                            {entry.workout_minutes ? ` · ${entry.workout_minutes} min` : ""}
                            {entry.calories_burned ? ` · ${entry.calories_burned} kcal` : ""}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        aria-label="Elimina"
                        style={{
                          color: colors.danger,
                          background: "none",
                          border: "none",
                          fontSize: font.size.sm,
                          cursor: "pointer",
                        }}
                      >
                        Elimina
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
