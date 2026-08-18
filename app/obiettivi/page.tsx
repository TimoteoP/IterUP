"use client";

// ============================================================
// IterUp — Obiettivi
// ------------------------------------------------------------
// CRUD obiettivi (titolo, goal_type, target_value/target_date
// opzionali) e cambio stato (in_corso/raggiunto/abbandonato).
// Quando lo stato passa a 'raggiunto' l'API valorizza completed_at.
// ============================================================

import { useEffect, useState, type FormEvent } from "react";
import { colors, radius, spacing, font } from "@/lib/design-tokens";
import type { Tables } from "@/lib/types";

// current_value/progress_pct: calcolati a runtime da GET /api/goals
// dai dati reali (peso/passi/streak abitudine), non persistiti — vedi
// PRD-addendum-hardening-completamento.md A6.
type Goal = Tables<"goals"> & { current_value: number | null; progress_pct: number | null };
type GoalType = Goal["goal_type"];
type GoalStatus = NonNullable<Goal["status"]>;

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  weight: "Peso",
  habit_streak: "Costanza abitudine",
  activity: "Attività",
  custom: "Personalizzato",
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  in_corso: "In corso",
  raggiunto: "Raggiunto",
  abbandonato: "Abbandonato",
};

const STATUS_COLORS: Record<GoalStatus, string> = {
  in_corso: colors.accent,
  raggiunto: colors.primary,
  abbandonato: colors.textMuted,
};

export default function ObiettiviPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form nuovo obiettivo
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("custom");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadGoals() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/goals");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento obiettivi");
      setGoals(json.goals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function handleCreateGoal(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          goal_type: goalType,
          target_value: targetValue === "" ? null : Number(targetValue),
          target_date: targetDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella creazione");
      setTitle("");
      setGoalType("custom");
      setTargetValue("");
      setTargetDate("");
      await loadGoals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(goal: Goal, status: GoalStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nell'aggiornamento");
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? json.goal : g)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    }
  }

  async function deleteGoal(goal: Goal) {
    if (!confirm(`Eliminare l'obiettivo "${goal.title}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nell'eliminazione");
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    }
  }

  const grouped: Record<GoalStatus, Goal[]> = {
    in_corso: goals.filter((g) => (g.status ?? "in_corso") === "in_corso"),
    raggiunto: goals.filter((g) => g.status === "raggiunto"),
    abbandonato: goals.filter((g) => g.status === "abbandonato"),
  };

  return (
    <main
      style={{
        backgroundColor: colors.background,
        color: colors.textPrimary,
        minHeight: "100vh",
        fontFamily: font.sans,
        padding: spacing.lg,
      }}
    >
      <div style={{ maxWidth: "40rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, marginBottom: spacing.xs }}>
          Obiettivi
        </h1>
        <p style={{ color: colors.textSecondary, marginBottom: spacing.lg, fontSize: font.size.sm }}>
          Traguardi di peso, attività, abitudini o personalizzati.
        </p>

        {error && (
          <div
            style={{
              backgroundColor: colors.surfaceAlt,
              border: `1px solid ${colors.danger}`,
              color: colors.danger,
              borderRadius: radius.md,
              padding: spacing.sm,
              marginBottom: spacing.md,
              fontSize: font.size.sm,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleCreateGoal}
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: spacing.xl,
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
          }}
        >
          <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold }}>
            Nuovo obiettivo
          </h2>
          <input
            type="text"
            placeholder="Titolo (es. Arrivare a 75kg)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
          />
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)}
            style={inputStyle}
          >
            {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map((gt) => (
              <option key={gt} value={gt}>
                {GOAL_TYPE_LABELS[gt]}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: spacing.sm }}>
            <input
              type="number"
              placeholder="Valore target (opzionale)"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? "Salvataggio…" : "Aggiungi obiettivo"}
          </button>
        </form>

        {loading ? (
          <p style={{ color: colors.textSecondary }}>Caricamento…</p>
        ) : goals.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
            Nessun obiettivo. Aggiungine uno qui sopra.
          </p>
        ) : (
          (["in_corso", "raggiunto", "abbandonato"] as GoalStatus[]).map((statusKey) =>
            grouped[statusKey].length === 0 ? null : (
              <section key={statusKey} style={{ marginBottom: spacing.xl }}>
                <h2
                  style={{
                    fontSize: font.size.lg,
                    fontWeight: font.weight.semibold,
                    marginBottom: spacing.sm,
                    color: STATUS_COLORS[statusKey],
                  }}
                >
                  {STATUS_LABELS[statusKey]}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                  {grouped[statusKey].map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      onChangeStatus={(status) => changeStatus(goal, status)}
                      onDelete={() => deleteGoal(goal)}
                    />
                  ))}
                </div>
              </section>
            )
          )
        )}
      </div>
    </main>
  );
}

function GoalRow({
  goal,
  onChangeStatus,
  onDelete,
}: {
  goal: Goal;
  onChangeStatus: (status: GoalStatus) => void;
  onDelete: () => void;
}) {
  const currentStatus: GoalStatus = goal.status ?? "in_corso";

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.medium }}>{goal.title}</div>
          <div style={{ fontSize: font.size.xs, color: colors.textMuted }}>
            {GOAL_TYPE_LABELS[goal.goal_type]}
            {goal.target_value != null ? ` · target ${goal.target_value}` : ""}
            {goal.target_date ? ` · entro ${goal.target_date}` : ""}
          </div>
          {goal.status === "raggiunto" && goal.completed_at && (
            <div style={{ fontSize: font.size.xs, color: colors.primary }}>
              Raggiunto il {new Date(goal.completed_at).toLocaleString("it-IT")}
            </div>
          )}
        </div>
        <button onClick={onDelete} style={dangerButtonStyle}>
          Elimina
        </button>
      </div>
      {goal.progress_pct !== null && (
        <div>
          <div
            style={{
              height: 6,
              borderRadius: radius.full,
              backgroundColor: colors.primaryMuted,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${goal.progress_pct}%`,
                height: "100%",
                backgroundColor: colors.primary,
              }}
            />
          </div>
          <div style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 }}>
            {goal.current_value} / {goal.target_value ?? "?"} ({goal.progress_pct}%) — calcolato automaticamente dai
            log reali
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: spacing.xs }}>
        {(["in_corso", "raggiunto", "abbandonato"] as GoalStatus[])
          .filter((s) => s !== currentStatus)
          .map((s) => (
            <button key={s} onClick={() => onChangeStatus(s)} style={secondaryButtonStyle}>
              Segna {STATUS_LABELS[s].toLowerCase()}
            </button>
          ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  color: colors.textPrimary,
  padding: `${spacing.xs} ${spacing.sm}`,
  fontSize: font.size.sm,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: colors.background,
  border: "none",
  borderRadius: radius.sm,
  padding: `${spacing.xs} ${spacing.md}`,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: colors.textSecondary,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: `${spacing.xs} ${spacing.sm}`,
  fontSize: font.size.xs,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: colors.danger,
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.sm,
  padding: `${spacing.xs} ${spacing.sm}`,
  fontSize: font.size.xs,
  cursor: "pointer",
};
