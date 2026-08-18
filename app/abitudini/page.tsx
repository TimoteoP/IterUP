"use client";

// ============================================================
// IterUp — Abitudini
// ------------------------------------------------------------
// CRUD abitudini + log giornaliero (checkbox per 'boolean',
// input numerico per 'quantity'), upsert su habit_logs per la
// data odierna. Tutte le mutazioni passano dalle API route sotto
// /app/api/habits (mai chiamate dirette a Supabase da qui).
// ============================================================

import { useEffect, useState, type FormEvent } from "react";
import { colors, radius, spacing, font } from "@/lib/design-tokens";
import type { Tables } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";

type Habit = Tables<"habits">;
type HabitLog = Tables<"habit_logs">;

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AbitudiniPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, HabitLog>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Form nuova abitudine
  const [name, setName] = useState("");
  const [type, setType] = useState<"boolean" | "quantity">("boolean");
  const [unit, setUnit] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Valori locali per input quantity (prima del save)
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        apiFetch("/api/habits"),
        apiFetch(`/api/habits/log?date=${todayISODate()}`),
      ]);
      const habitsJson = await habitsRes.json();
      const logsJson = await logsRes.json();

      if (!habitsRes.ok) throw new Error(habitsJson.error ?? "Errore nel caricamento abitudini");
      if (!logsRes.ok) throw new Error(logsJson.error ?? "Errore nel caricamento log");

      setHabits(habitsJson.habits ?? []);
      const logsMap: Record<string, HabitLog> = {};
      for (const log of (logsJson.logs ?? []) as HabitLog[]) {
        logsMap[log.habit_id] = log;
      }
      setLogs(logsMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreateHabit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          unit: type === "quantity" ? unit.trim() || null : null,
          target_value: targetValue === "" ? null : Number(targetValue),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella creazione");
      setName("");
      setUnit("");
      setTargetValue("");
      setType("boolean");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleBoolean(habit: Habit) {
    const current = logs[habit.id];
    const nextCompleted = !(current?.completed ?? false);
    setError(null);
    try {
      const res = await apiFetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habit_id: habit.id,
          recorded_at: todayISODate(),
          completed: nextCompleted,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");
      setLogs((prev) => ({ ...prev, [habit.id]: json.log }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    }
  }

  async function saveQuantity(habit: Habit) {
    const raw = pendingValues[habit.id];
    const value = raw === undefined ? logs[habit.id]?.value ?? null : raw === "" ? null : Number(raw);
    setError(null);
    try {
      const res = await apiFetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habit_id: habit.id,
          recorded_at: todayISODate(),
          value,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");
      setLogs((prev) => ({ ...prev, [habit.id]: json.log }));
      setPendingValues((prev) => {
        const next = { ...prev };
        delete next[habit.id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    }
  }

  async function toggleActive(habit: Habit) {
    setError(null);
    try {
      const res = await apiFetch(`/api/habits/${habit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !habit.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nell'aggiornamento");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    }
  }

  async function deleteHabit(habit: Habit) {
    if (!confirm(`Eliminare definitivamente "${habit.name}"? Verranno persi anche i log.`)) return;
    setError(null);
    try {
      const res = await apiFetch(`/api/habits/${habit.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nell'eliminazione");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    }
  }

  const activeHabits = habits.filter((h) => h.is_active);
  const archivedHabits = habits.filter((h) => !h.is_active);

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
          Abitudini
        </h1>
        <p style={{ color: colors.textSecondary, marginBottom: spacing.lg, fontSize: font.size.sm }}>
          Segna il progresso di oggi ({todayISODate()}).
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

        {/* Form nuova abitudine */}
        <form
          onSubmit={handleCreateHabit}
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
            Nuova abitudine
          </h2>
          <input
            type="text"
            placeholder="Nome (es. Bere acqua)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: spacing.sm }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "boolean" | "quantity")}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="boolean">Sì/No</option>
              <option value="quantity">Quantità</option>
            </select>
            {type === "quantity" && (
              <input
                type="text"
                placeholder="Unità (es. bicchieri)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            )}
          </div>
          <input
            type="number"
            placeholder="Target opzionale"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? "Salvataggio…" : "Aggiungi abitudine"}
          </button>
        </form>

        {loading ? (
          <p style={{ color: colors.textSecondary }}>Caricamento…</p>
        ) : (
          <>
            <section style={{ marginBottom: spacing.xl }}>
              <h2 style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, marginBottom: spacing.sm }}>
                Attive
              </h2>
              {activeHabits.length === 0 ? (
                <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
                  Nessuna abitudine attiva. Aggiungine una qui sopra.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                  {activeHabits.map((habit) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      log={logs[habit.id]}
                      pendingValue={pendingValues[habit.id]}
                      onPendingValueChange={(v) =>
                        setPendingValues((prev) => ({ ...prev, [habit.id]: v }))
                      }
                      onToggleBoolean={() => toggleBoolean(habit)}
                      onSaveQuantity={() => saveQuantity(habit)}
                      onToggleActive={() => toggleActive(habit)}
                      onDelete={() => deleteHabit(habit)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <button
                onClick={() => setShowArchived((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.accent,
                  fontSize: font.size.sm,
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: spacing.sm,
                }}
              >
                {showArchived ? "Nascondi" : "Mostra"} archiviate ({archivedHabits.length})
              </button>
              {showArchived && (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                  {archivedHabits.length === 0 ? (
                    <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
                      Nessuna abitudine archiviata.
                    </p>
                  ) : (
                    archivedHabits.map((habit) => (
                      <div
                        key={habit.id}
                        style={{
                          backgroundColor: colors.surface,
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          opacity: 0.7,
                        }}
                      >
                        <span style={{ fontSize: font.size.sm }}>{habit.name}</span>
                        <div style={{ display: "flex", gap: spacing.sm }}>
                          <button onClick={() => toggleActive(habit)} style={secondaryButtonStyle}>
                            Riattiva
                          </button>
                          <button onClick={() => deleteHabit(habit)} style={dangerButtonStyle}>
                            Elimina
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function HabitRow({
  habit,
  log,
  pendingValue,
  onPendingValueChange,
  onToggleBoolean,
  onSaveQuantity,
  onToggleActive,
  onDelete,
}: {
  habit: Habit;
  log: HabitLog | undefined;
  pendingValue: string | undefined;
  onPendingValueChange: (v: string) => void;
  onToggleBoolean: () => void;
  onSaveQuantity: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const displayValue = pendingValue ?? (log?.value != null ? String(log.value) : "");
  const reachedTarget =
    habit.type === "quantity" &&
    habit.target_value != null &&
    log?.value != null &&
    log.value >= habit.target_value;

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1 }}>
        {habit.type === "boolean" ? (
          <input
            type="checkbox"
            checked={Boolean(log?.completed)}
            onChange={onToggleBoolean}
            style={{ width: "1.25rem", height: "1.25rem", accentColor: colors.primary }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
            <input
              type="number"
              value={displayValue}
              onChange={(e) => onPendingValueChange(e.target.value)}
              onBlur={onSaveQuantity}
              style={{ ...inputStyle, width: "5rem", padding: spacing.xs }}
            />
            {habit.unit && (
              <span style={{ color: colors.textMuted, fontSize: font.size.xs }}>{habit.unit}</span>
            )}
          </div>
        )}
        <div>
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.medium }}>{habit.name}</div>
          {habit.type === "quantity" && habit.target_value != null && (
            <div
              style={{
                fontSize: font.size.xs,
                color: reachedTarget ? colors.primary : colors.textMuted,
              }}
            >
              target: {habit.target_value} {habit.unit ?? ""}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: spacing.xs }}>
        <button onClick={onToggleActive} style={secondaryButtonStyle}>
          Archivia
        </button>
        <button onClick={onDelete} style={dangerButtonStyle}>
          Elimina
        </button>
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
