"use client";

// ============================================================
// IterUp — Misure e peso (tab "Misure" di /misure)
// ------------------------------------------------------------
// Form di inserimento (upsert giornaliero) + storico misurazioni,
// più recenti prima. Colori/spacing/font da /lib/design-tokens.ts.
// ============================================================

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { colors, spacing, font } from "@/lib/design-tokens";
import type { Tables } from "@/lib/types";
import { WEIGHT_RANGE, CIRCUMFERENCE_RANGE, todayISODate } from "@/app/api/body-metrics/validation";
import { apiFetch } from "@/lib/api-client";

type BodyMetric = Tables<"body_metrics">;

type FormState = {
  recorded_at: string;
  weight_kg: string;
  neck_cm: string;
  chest_cm: string;
  waist_cm: string;
  thigh_cm: string;
};

function emptyForm(): FormState {
  return {
    recorded_at: todayISODate(),
    weight_kg: "",
    neck_cm: "",
    chest_cm: "",
    waist_cm: "",
    thigh_cm: "",
  };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatValue(value: number | null): string {
  if (value === null || value === undefined) return "—";
  // numeric di Postgres arriva come stringa o numero a seconda del driver:
  // normalizziamo comunque a numero prima di formattare.
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  borderColor: colors.border,
  color: colors.textPrimary,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="mb-1 block"
      style={{ color: colors.textSecondary, fontSize: font.size.sm, fontWeight: font.weight.medium }}
    >
      {children}
    </label>
  );
}

export default function MisurePage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [history, setHistory] = useState<BodyMetric[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await apiFetch("/api/body-metrics", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento dello storico.");
      const rows: BodyMetric[] = json.data ?? [];
      rows.sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1));
      setHistory(rows);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Errore nel caricamento dello storico.");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateClientSide(): string | null {
    if (!form.recorded_at) return "La data è obbligatoria.";

    const weight = Number(form.weight_kg);
    if (form.weight_kg.trim() === "" || Number.isNaN(weight)) {
      return "Il peso è obbligatorio.";
    }
    if (weight < WEIGHT_RANGE.min || weight > WEIGHT_RANGE.max) {
      return `Il peso deve essere tra ${WEIGHT_RANGE.min} e ${WEIGHT_RANGE.max} kg.`;
    }

    const circumferenceFields: Array<[string, string]> = [
      ["Il collo", form.neck_cm],
      ["Il petto", form.chest_cm],
      ["La vita", form.waist_cm],
      ["La coscia", form.thigh_cm],
    ];
    for (const [label, raw] of circumferenceFields) {
      if (raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isNaN(n)) return `${label} deve essere un numero.`;
      if (n < CIRCUMFERENCE_RANGE.min || n > CIRCUMFERENCE_RANGE.max) {
        return `${label} deve essere tra ${CIRCUMFERENCE_RANGE.min} e ${CIRCUMFERENCE_RANGE.max} cm.`;
      }
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clientError = validateClientSide();
    if (clientError) {
      setErrorMsg(clientError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/body-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recorded_at: form.recorded_at,
          weight_kg: form.weight_kg,
          neck_cm: form.neck_cm || null,
          chest_cm: form.chest_cm || null,
          waist_cm: form.waist_cm || null,
          thigh_cm: form.thigh_cm || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio.");

      setSuccessMsg("Misurazione salvata.");
      setForm((prev) => ({ ...emptyForm(), recorded_at: prev.recorded_at }));
      await loadHistory();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Errore nel salvataggio.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/body-metrics/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella cancellazione.");
      setHistory((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Errore nella cancellazione.");
    } finally {
      setDeletingId(null);
    }
  }

  const hasAnyCircumference = useMemo(
    () =>
      history.some(
        (row) => row.neck_cm !== null || row.chest_cm !== null || row.waist_cm !== null || row.thigh_cm !== null
      ),
    [history]
  );

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-8"
      style={{ backgroundColor: colors.background, fontFamily: font.sans }}
    >
      <div className="mx-auto flex max-w-3xl flex-col" style={{ gap: spacing.xl }}>
        <header>
          <h1 style={{ color: colors.textPrimary, fontSize: font.size.xxl, fontWeight: font.weight.bold }}>
            Misure e peso
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            Registra il peso e le circonferenze. Una sola misurazione al giorno: se inserisci di
            nuovo una data già presente, la sovrascrivi.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-[1rem] border p-4 sm:p-6"
          style={cardStyle}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <FieldLabel>Data</FieldLabel>
              <input
                type="date"
                required
                value={form.recorded_at}
                max={todayISODate()}
                onChange={(e) => setForm((f) => ({ ...f, recorded_at: e.target.value }))}
                className="w-full rounded-[0.375rem] border px-3 py-2 outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <FieldLabel>Peso (kg) *</FieldLabel>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={WEIGHT_RANGE.min}
                max={WEIGHT_RANGE.max}
                required
                placeholder="es. 78.5"
                value={form.weight_kg}
                onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                className="w-full rounded-[0.375rem] border px-3 py-2 outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <FieldLabel>Collo (cm)</FieldLabel>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={CIRCUMFERENCE_RANGE.min}
                max={CIRCUMFERENCE_RANGE.max}
                placeholder="opzionale"
                value={form.neck_cm}
                onChange={(e) => setForm((f) => ({ ...f, neck_cm: e.target.value }))}
                className="w-full rounded-[0.375rem] border px-3 py-2 outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <FieldLabel>Petto (cm)</FieldLabel>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={CIRCUMFERENCE_RANGE.min}
                max={CIRCUMFERENCE_RANGE.max}
                placeholder="opzionale"
                value={form.chest_cm}
                onChange={(e) => setForm((f) => ({ ...f, chest_cm: e.target.value }))}
                className="w-full rounded-[0.375rem] border px-3 py-2 outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <FieldLabel>Vita (cm)</FieldLabel>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={CIRCUMFERENCE_RANGE.min}
                max={CIRCUMFERENCE_RANGE.max}
                placeholder="opzionale"
                value={form.waist_cm}
                onChange={(e) => setForm((f) => ({ ...f, waist_cm: e.target.value }))}
                className="w-full rounded-[0.375rem] border px-3 py-2 outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <FieldLabel>Coscia (cm)</FieldLabel>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={CIRCUMFERENCE_RANGE.min}
                max={CIRCUMFERENCE_RANGE.max}
                placeholder="opzionale"
                value={form.thigh_cm}
                onChange={(e) => setForm((f) => ({ ...f, thigh_cm: e.target.value }))}
                className="w-full rounded-[0.375rem] border px-3 py-2 outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {errorMsg && (
            <p className="mt-4" style={{ color: colors.danger, fontSize: font.size.sm }}>
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p className="mt-4" style={{ color: colors.primary, fontSize: font.size.sm }}>
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-[9999px] px-5 py-2 disabled:opacity-50"
            style={{
              backgroundColor: colors.primary,
              color: colors.background,
              fontWeight: font.weight.semibold,
            }}
          >
            {submitting ? "Salvataggio…" : "Salva misurazione"}
          </button>
        </form>

        <section className="rounded-[1rem] border p-4 sm:p-6" style={cardStyle}>
          <h2 style={{ color: colors.textPrimary, fontSize: font.size.lg, fontWeight: font.weight.semibold }}>
            Storico
          </h2>

          {loadingHistory ? (
            <p className="mt-3" style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Caricamento…
            </p>
          ) : history.length === 0 ? (
            <p className="mt-3" style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              Nessuna misurazione registrata.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse" style={{ fontSize: font.size.sm }}>
                <thead>
                  <tr style={{ color: colors.textSecondary }}>
                    <th className="whitespace-nowrap px-2 py-2 text-left">Data</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">Peso (kg)</th>
                    {hasAnyCircumference && (
                      <>
                        <th className="whitespace-nowrap px-2 py-2 text-right">Collo (cm)</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right">Petto (cm)</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right">Vita (cm)</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right">Coscia (cm)</th>
                      </>
                    )}
                    <th className="whitespace-nowrap px-2 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t" style={{ borderColor: colors.border }}>
                      <td className="whitespace-nowrap px-2 py-2" style={{ color: colors.textPrimary }}>
                        {formatDate(row.recorded_at)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right" style={{ color: colors.textPrimary }}>
                        {formatValue(row.weight_kg)}
                      </td>
                      {hasAnyCircumference && (
                        <>
                          <td className="whitespace-nowrap px-2 py-2 text-right" style={{ color: colors.textSecondary }}>
                            {formatValue(row.neck_cm)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right" style={{ color: colors.textSecondary }}>
                            {formatValue(row.chest_cm)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right" style={{ color: colors.textSecondary }}>
                            {formatValue(row.waist_cm)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right" style={{ color: colors.textSecondary }}>
                            {formatValue(row.thigh_cm)}
                          </td>
                        </>
                      )}
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          style={{ color: colors.danger, fontSize: font.size.xs }}
                          className="disabled:opacity-50"
                        >
                          {deletingId === row.id ? "…" : "Elimina"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
