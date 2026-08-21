"use client";

// ============================================================
// IterUp — Pensieri: storico entry
// ============================================================

import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import Link from "next/link";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";
import { themeLabel, distortionLabel } from "@/lib/self-talk-taxonomy";

interface DistortionTag {
  id: string;
  distortion_type: string;
  source: "user" | "llm";
}

interface Entry {
  id: string;
  raw_text: string;
  mood_before: number | null;
  theme: string | null;
  created_at: string;
  guided_session_started: boolean;
  guided_session_completed: boolean;
  tags: DistortionTag[];
}

export interface EntriesListHandle {
  reload: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const EntriesList = forwardRef<EntriesListHandle>((_props, ref) => {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch("/api/self-talk/entries")
      .then((res) => res.json())
      .then((json) => setEntries(json.entries ?? []))
      .catch(() => setError("Errore nel caricamento dello storico"));
  }

  useEffect(load, []);
  useImperativeHandle(ref, () => ({ reload: load }));

  if (error) return <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>;
  if (entries === null) return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>;
  if (entries.length === 0) {
    return <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Nessun pensiero registrato ancora.</p>;
  }

  return (
    <div className="flex flex-col" style={{ gap: spacing.sm }}>
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={`/pensieri/${entry.id}`}
          style={{
            display: "block",
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            padding: spacing.sm,
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: spacing.xs }}>
            <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>{formatDate(entry.created_at)}</span>
            <span
              style={{
                fontSize: font.size.xs,
                color: entry.guided_session_completed ? colors.primary : colors.textMuted,
              }}
            >
              {entry.guided_session_completed ? "Lavorato" : entry.guided_session_started ? "In corso" : "Solo registrato"}
            </span>
          </div>
          <p
            style={{
              fontSize: font.size.sm,
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {entry.raw_text}
          </p>
          <div className="flex flex-wrap items-center" style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {entry.theme && (
              <span style={{ fontSize: font.size.xs, color: colors.accent, backgroundColor: colors.primaryMuted, borderRadius: radius.full, padding: "2px 8px" }}>
                {themeLabel(entry.theme)}
              </span>
            )}
            {entry.tags.map((tag) => (
              <span
                key={tag.id}
                title={tag.source === "llm" ? "Suggerito dall'AI" : "Aggiunto da te"}
                style={{
                  fontSize: font.size.xs,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.full,
                  padding: "2px 8px",
                }}
              >
                {distortionLabel(tag.distortion_type)}
                {tag.source === "llm" ? " 🤖" : ""}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
});

EntriesList.displayName = "EntriesList";

export default EntriesList;
