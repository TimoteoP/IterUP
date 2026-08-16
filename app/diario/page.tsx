"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import MacroProgressBar from "./MacroProgressBar";
import MealSuggestions from "./components/MealSuggestions";
import { MEAL_TYPES_WITHOUT_FOOD } from "@/lib/nutrition-options";
import {
  MEAL_TYPES,
  MEAL_LABELS,
  type MealType,
  type FoodResult,
  type LogWithMacros,
  type LogsSummary,
} from "./types";

const FOOD_MEAL_TYPES = MEAL_TYPES.filter((mt) => !MEAL_TYPES_WITHOUT_FOOD.includes(mt));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function inferMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "colazione";
  if (hour < 16) return "pranzo";
  if (hour < 21) return "cena";
  return "spuntino";
}

function formatDateLabel(iso: string): string {
  const today = todayIso();
  if (iso === today) return "Oggi";
  if (iso === addDays(today, -1)) return "Ieri";
  if (iso === addDays(today, 1)) return "Domani";
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

export default function DiarioPage() {
  const [date, setDate] = useState(todayIso());

  const [logs, setLogs] = useState<LogWithMacros[]>([]);
  const [summary, setSummary] = useState<LogsSummary | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [mealType, setMealType] = useState<MealType>(inferMealType());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingLogs(true);
    setLoadError(null);
    try {
      const [logsRes, summaryRes] = await Promise.all([
        fetch(`/api/logs?date=${date}`),
        fetch(`/api/logs/summary?date=${date}`),
      ]);
      const logsJson = await logsRes.json();
      const summaryJson = await summaryRes.json();
      if (!logsRes.ok) throw new Error(logsJson.error ?? "Errore nel caricamento del diario");
      if (!summaryRes.ok) throw new Error(summaryJson.error ?? "Errore nel calcolo dei macro");
      setLogs(logsJson.logs ?? []);
      setSummary(summaryJson);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoadingLogs(false);
    }
  }, [date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Ricerca alimenti con debounce: evita una richiesta ad ogni tasto.
  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        setResults(res.ok ? json.foods ?? [] : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleSelectFood(food: FoodResult) {
    setSelectedFood(food);
    setQuery(food.name);
    setResults([]);
    setAddError(null);
  }

  function clearSelection() {
    setSelectedFood(null);
    setQuery("");
    setQuantity("100");
    setAddError(null);
  }

  async function handleAdd() {
    if (!selectedFood) {
      setAddError("Seleziona prima un alimento dalla ricerca.");
      return;
    }
    const quantityNumber = Number(quantity);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      setAddError("Inserisci una quantità in grammi maggiore di 0.");
      return;
    }

    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_id: selectedFood.id,
          quantity_g: quantityNumber,
          meal_type: mealType,
          logged_at: date,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");
      clearSelection();
      await refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/logs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Errore nella cancellazione");
      }
      await refresh();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Errore sconosciuto");
    }
  }

  const logsByMeal = useMemo(() => {
    const grouped: Record<MealType, LogWithMacros[]> = {
      colazione: [],
      pranzo: [],
      cena: [],
      spuntino: [],
      digiuno: [],
      integrazione: [],
    };
    for (const log of logs) {
      grouped[log.meal_type].push(log);
    }
    return grouped;
  }, [logs]);

  const [loggingFast, setLoggingFast] = useState(false);

  async function handleLogFast(type: Extract<MealType, "digiuno">) {
    setLoggingFast(true);
    setAddError(null);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_type: type, logged_at: date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");
      await refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoggingFast(false);
    }
  }

  const previewMacros = useMemo(() => {
    if (!selectedFood) return null;
    const quantityNumber = Number(quantity);
    const factor = Number.isFinite(quantityNumber) ? quantityNumber / 100 : 0;
    return {
      kcal: selectedFood.kcal_100g * factor,
      protein_g: selectedFood.protein_100g * factor,
      carbs_g: selectedFood.carbs_100g * factor,
      fat_g: selectedFood.fat_100g * factor,
    };
  }, [selectedFood, quantity]);

  return (
    <main
      className="min-h-screen w-full"
      style={{ backgroundColor: colors.background, color: colors.textPrimary }}
    >
      <div
        className="mx-auto flex max-w-2xl flex-col"
        style={{ padding: spacing.lg, gap: spacing.lg }}
      >
        {/* Header con navigazione data */}
        <header className="flex items-center justify-between">
          <h1 style={{ fontSize: font.size.xl, fontWeight: font.weight.bold }}>
            Diario Alimentare
          </h1>
          <div className="flex items-center" style={{ gap: spacing.sm }}>
            <button
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="Giorno precedente"
              className="flex items-center justify-center"
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
                color: colors.textPrimary,
              }}
            >
              ‹
            </button>
            <span
              style={{
                fontSize: font.size.sm,
                color: colors.textSecondary,
                minWidth: "5.5rem",
                textAlign: "center",
              }}
            >
              {formatDateLabel(date)}
            </span>
            <button
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="Giorno successivo"
              className="flex items-center justify-center"
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
                color: colors.textPrimary,
              }}
            >
              ›
            </button>
          </div>
        </header>

        {/* Macro residui */}
        <section style={cardStyle} className="flex flex-col" >
          <h2
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Macro residui
          </h2>
          {loadingLogs ? (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>
          ) : summary?.target ? (
            <div className="flex flex-col" style={{ gap: spacing.md }}>
              <MacroProgressBar
                label="Calorie"
                unit="kcal"
                consumed={summary.consumed.kcal}
                target={summary.target.daily_kcal}
                color={colors.macro.kcal}
              />
              <MacroProgressBar
                label="Proteine"
                unit="g"
                consumed={summary.consumed.protein_g}
                target={summary.target.protein_g}
                color={colors.macro.protein}
              />
              <MacroProgressBar
                label="Carboidrati"
                unit="g"
                consumed={summary.consumed.carbs_g}
                target={summary.target.carbs_g}
                color={colors.macro.carbs}
              />
              <MacroProgressBar
                label="Grassi"
                unit="g"
                consumed={summary.consumed.fat_g}
                target={summary.target.fat_g}
                color={colors.macro.fat}
              />
            </div>
          ) : (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Nessun obiettivo attivo impostato. Le calorie e i macro consumati oggi sono{" "}
              {Math.round(summary?.consumed.kcal ?? 0)} kcal, ma senza un target in
              &quot;user_targets&quot; non è possibile calcolare i residui.
            </p>
          )}
        </section>

        {/* Ricerca e aggiunta alimento */}
        <section style={cardStyle} className="flex flex-col" >
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: spacing.md }}
          >
            <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold }}>
              Aggiungi alimento
            </h2>
            <button
              onClick={() => handleLogFast("digiuno")}
              disabled={loggingFast}
              style={{
                fontSize: font.size.xs,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.full,
                padding: `2px ${spacing.sm}`,
                opacity: loggingFast ? 0.6 : 1,
              }}
            >
              Registra digiuno
            </button>
          </div>

          <div className="flex items-end" style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <label className="flex flex-col" style={{ gap: spacing.xs, flex: 1 }}>
              <span style={{ fontSize: font.size.xs, color: colors.textSecondary }}>Pasto</span>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: `${spacing.sm} ${spacing.md}`,
                  color: colors.textPrimary,
                  fontSize: font.size.sm,
                }}
              >
                {FOOD_MEAL_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {MEAL_LABELS[mt]}
                  </option>
                ))}
              </select>
            </label>
            <MealSuggestions
              mealType={mealType as "colazione" | "pranzo" | "cena" | "spuntino"}
              logDate={date}
              onLogged={refresh}
            />
          </div>

          <div className="relative flex flex-col" style={{ gap: spacing.sm }}>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedFood) setSelectedFood(null);
              }}
              placeholder="Cerca un alimento (es. pollo, riso, mela...)"
              style={{
                backgroundColor: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: `${spacing.sm} ${spacing.md}`,
                color: colors.textPrimary,
                fontSize: font.size.md,
              }}
            />

            {query.trim().length > 0 && !selectedFood && (
              <div
                className="flex flex-col overflow-hidden"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceAlt,
                  maxHeight: "16rem",
                  overflowY: "auto",
                }}
              >
                {searching && (
                  <p
                    style={{
                      padding: spacing.sm,
                      color: colors.textMuted,
                      fontSize: font.size.sm,
                    }}
                  >
                    Ricerca…
                  </p>
                )}
                {!searching && results.length === 0 && (
                  <p
                    style={{
                      padding: spacing.sm,
                      color: colors.textMuted,
                      fontSize: font.size.sm,
                    }}
                  >
                    Nessun alimento trovato.
                  </p>
                )}
                {!searching &&
                  results.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => handleSelectFood(food)}
                      className="flex items-center justify-between text-left"
                      style={{
                        padding: spacing.sm,
                        borderBottom: `1px solid ${colors.border}`,
                        color: colors.textPrimary,
                      }}
                    >
                      <span style={{ fontSize: font.size.sm }}>{food.name}</span>
                      <span
                        style={{ fontSize: font.size.xs, color: colors.textMuted }}
                      >
                        {Math.round(food.kcal_100g)} kcal/100g
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {selectedFood && (
            <div className="flex flex-col" style={{ gap: spacing.md, marginTop: spacing.md }}>
              <div
                className="flex items-center justify-between"
                style={{
                  backgroundColor: colors.primaryMuted,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                }}
              >
                <span style={{ fontSize: font.size.sm, fontWeight: font.weight.medium }}>
                  {selectedFood.name}
                </span>
                <button
                  onClick={clearSelection}
                  aria-label="Deseleziona alimento"
                  style={{ color: colors.textSecondary, fontSize: font.size.sm }}
                >
                  Cambia
                </button>
              </div>

              <label className="flex flex-col" style={{ gap: spacing.xs }}>
                <span style={{ fontSize: font.size.xs, color: colors.textSecondary }}>
                  Quantità (g)
                </span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: `${spacing.sm} ${spacing.md}`,
                    color: colors.textPrimary,
                    fontSize: font.size.md,
                  }}
                />
              </label>

              {previewMacros && (
                <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                  {Math.round(previewMacros.kcal)} kcal · P {Math.round(previewMacros.protein_g)}g
                  · C {Math.round(previewMacros.carbs_g)}g · G {Math.round(previewMacros.fat_g)}g
                </p>
              )}

              {addError && (
                <p style={{ fontSize: font.size.sm, color: colors.danger }}>{addError}</p>
              )}

              <button
                onClick={handleAdd}
                disabled={adding}
                style={{
                  backgroundColor: colors.primary,
                  color: colors.background,
                  borderRadius: radius.md,
                  padding: `${spacing.sm} ${spacing.md}`,
                  fontWeight: font.weight.semibold,
                  fontSize: font.size.md,
                  opacity: adding ? 0.6 : 1,
                }}
              >
                {adding ? "Salvataggio…" : "Aggiungi al diario"}
              </button>
            </div>
          )}
        </section>

        {/* Log del giorno, raggruppati per pasto */}
        <section className="flex flex-col" style={{ gap: spacing.md }}>
          {loadError && (
            <p style={{ color: colors.danger, fontSize: font.size.sm }}>{loadError}</p>
          )}
          {MEAL_TYPES.map((mt) => {
            const items = logsByMeal[mt];
            if (items.length === 0) return null;
            const mealKcal = items.reduce((sum, l) => sum + l.kcal, 0);
            return (
              <div key={mt} style={cardStyle}>
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: spacing.sm }}
                >
                  <h3 style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold }}>
                    {MEAL_LABELS[mt]}
                  </h3>
                  <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                    {Math.round(mealKcal)} kcal
                  </span>
                </div>
                <ul className="flex flex-col" style={{ gap: spacing.xs }}>
                  {items.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between"
                      style={{
                        padding: `${spacing.xs} 0`,
                        borderTop: `1px solid ${colors.border}`,
                      }}
                    >
                      <div className="flex flex-col">
                        <span style={{ fontSize: font.size.sm }}>
                          {log.food_name ?? MEAL_LABELS[log.meal_type]}
                        </span>
                        <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                          {log.quantity_g !== null
                            ? `${log.quantity_g}g · ${Math.round(log.kcal)} kcal`
                            : "Registrato"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(log.id)}
                        aria-label={`Rimuovi ${log.food_name ?? MEAL_LABELS[log.meal_type]}`}
                        style={{ color: colors.textMuted, fontSize: font.size.lg }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!loadingLogs && logs.length === 0 && (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Nessun alimento registrato per {formatDateLabel(date).toLowerCase()}.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
