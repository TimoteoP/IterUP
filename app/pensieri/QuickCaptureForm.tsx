"use client";

// ============================================================
// IterUp — Pensieri: cattura rapida
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 4, step 1-2:
// l'unico step obbligatorio è il testo libero, deve restare
// semplice/veloce. Dopo il salvataggio, offerta non invasiva di
// lavorarci subito o solo registrarlo (principio ACT, non forzare
// sempre l'engagement attivo).
// ============================================================

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";

interface CreatedEntry {
  id: string;
  raw_text: string;
}

export default function QuickCaptureForm({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [includeMood, setIncludeMood] = useState(false);
  const [mood, setMood] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<CreatedEntry | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    setJustSaved(null);
    try {
      const res = await apiFetch("/api/self-talk/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: trimmed, moodBefore: includeMood ? mood : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");

      setText("");
      setIncludeMood(false);
      setMood(5);
      setJustSaved({ id: json.entry.id, raw_text: json.entry.raw_text });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  }

  if (justSaved) {
    return (
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          padding: spacing.md,
        }}
      >
        <p style={{ fontSize: font.size.sm, color: colors.textPrimary, marginBottom: spacing.sm }}>
          Registrato. Vuoi lavorarci sopra ora (2 min) o solo registrarlo?
        </p>
        <div className="flex" style={{ gap: spacing.sm }}>
          <button
            type="button"
            onClick={() => router.push(`/pensieri/${justSaved.id}`)}
            style={{
              backgroundColor: colors.primary,
              color: colors.background,
              borderRadius: radius.md,
              padding: `${spacing.xs} ${spacing.md}`,
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
            }}
          >
            Lavoraci ora
          </button>
          <button
            type="button"
            onClick={() => setJustSaved(null)}
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
              borderRadius: radius.md,
              padding: `${spacing.xs} ${spacing.md}`,
              fontSize: font.size.sm,
            }}
          >
            Solo registrare
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: spacing.sm }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cosa ti sei detto? Scrivilo così com'è, senza filtrarlo."
        rows={3}
        autoFocus
        style={{
          backgroundColor: colors.surfaceAlt,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: font.size.md,
          resize: "vertical",
        }}
      />

      <div className="flex items-center" style={{ gap: spacing.sm }}>
        <label className="flex items-center" style={{ gap: spacing.xs, fontSize: font.size.xs, color: colors.textSecondary }}>
          <input type="checkbox" checked={includeMood} onChange={(e) => setIncludeMood(e.target.checked)} />
          Umore prima (opzionale)
        </label>
        {includeMood && (
          <>
            <input
              type="range"
              min={1}
              max={10}
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              style={{ accentColor: colors.primary, flex: 1, maxWidth: 160 }}
            />
            <span style={{ fontSize: font.size.xs, color: colors.textMuted, minWidth: "2.5em" }}>{mood}/10</span>
          </>
        )}
      </div>

      {error && <p style={{ fontSize: font.size.xs, color: colors.danger }}>{error}</p>}

      <button
        type="submit"
        disabled={saving || !text.trim()}
        style={{
          alignSelf: "flex-start",
          backgroundColor: colors.primary,
          color: colors.background,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.lg}`,
          fontSize: font.size.sm,
          fontWeight: font.weight.semibold,
          opacity: saving || !text.trim() ? 0.6 : 1,
        }}
      >
        {saving ? "Salvataggio…" : "Registra"}
      </button>
    </form>
  );
}
