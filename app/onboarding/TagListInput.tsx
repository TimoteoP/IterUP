"use client";

// ============================================================
// IterUp — input per liste strutturate (allergie, preferenze)
// ------------------------------------------------------------
// Invece di un campo testo libero non strutturato (vedi
// PRD-addendum-onboarding-form.md sezione 6), l'utente aggiunge voci
// una alla volta come "tag": più facile da validare/controllare
// automaticamente lato generatore AI.
// ============================================================

import { useState, type KeyboardEvent } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";

interface TagListInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  tagColor?: string;
}

export default function TagListInput({
  values,
  onChange,
  placeholder,
  tagColor = colors.accent,
}: TagListInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      removeTag(values.length - 1);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.xs,
          marginBottom: values.length > 0 ? spacing.xs : 0,
        }}
      >
        {values.map((value, i) => (
          <span
            key={`${value}-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacing.xs,
              padding: `2px ${spacing.sm}`,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceAlt,
              border: `1px solid ${tagColor}`,
              color: colors.textPrimary,
              fontSize: font.size.xs,
            }}
          >
            {value}
            <button
              type="button"
              onClick={() => removeTag(i)}
              aria-label={`Rimuovi ${value}`}
              style={{
                background: "none",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                fontSize: font.size.sm,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: spacing.xs }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
            fontFamily: font.sans,
          }}
        />
        <button
          type="button"
          onClick={addTag}
          style={{
            backgroundColor: colors.surfaceAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            color: colors.textPrimary,
            fontSize: font.size.sm,
            cursor: "pointer",
          }}
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}
