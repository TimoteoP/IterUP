"use client";

// ============================================================
// IterUp — chat integratori con grounding
// ------------------------------------------------------------
// Vedi PRD-addendum-onboarding-form.md sezioni 5.2-5.3. Disclaimer
// sempre visibile (non solo nel PRD), citazioni come link cliccabili,
// cronologia persistita (GET/POST /api/supplements/chat).
// ============================================================

import { useEffect, useRef, useState, type FormEvent } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import type { Tables } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";

type ChatMessage = Tables<"supplement_chat_messages">;

function CitationsList({ citations }: { citations: unknown }) {
  const list = Array.isArray(citations) ? (citations as { url: string; title?: string }[]) : [];
  if (list.length === 0) return null;
  return (
    <div style={{ marginTop: spacing.xs, display: "flex", flexDirection: "column", gap: 2 }}>
      {list.map((c, i) => (
        <a
          key={i}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: font.size.xs, color: colors.accent, textDecoration: "underline" }}
        >
          🔗 {c.title || c.url}
        </a>
      ))}
    </div>
  );
}

export default function SupplementChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/supplements/chat")
      .then((res) => res.json())
      .then((json) => setMessages(json.messages ?? []))
      .catch(() => setError("Errore nel caricamento della cronologia"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");
    try {
      const res = await apiFetch("/api/supplements/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella chat");
      setMessages((prev) => [...prev, json.userMessage, json.assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
      // Il messaggio utente potrebbe essere stato salvato lato server
      // anche se la chiamata AI è fallita: ricarichiamo per certezza.
      fetch("/api/supplements/chat")
        .then((res) => res.json())
        .then((json) => setMessages(json.messages ?? []))
        .catch(() => {});
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p
        style={{
          fontSize: font.size.xs,
          color: colors.warning,
          backgroundColor: colors.surfaceAlt,
          border: `1px solid ${colors.warning}`,
          borderRadius: radius.md,
          padding: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        ⚠ Risposte generate da un&apos;AI, non un parere medico o farmacologico. Ogni affermazione è etichettata
        [Evidenza scientifica] o [Anedottico] — verifica sempre con un professionista sanitario prima di
        cambiare l&apos;assunzione di un integratore.
      </p>

      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          padding: spacing.sm,
          maxHeight: 360,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: spacing.sm,
        }}
      >
        {loading && <p style={{ fontSize: font.size.sm, color: colors.textMuted }}>Caricamento…</p>}
        {!loading && messages.length === 0 && (
          <p style={{ fontSize: font.size.sm, color: colors.textMuted }}>
            Fai una domanda sui tuoi integratori, es. &quot;Posso prendere la curcumina con la berberina o è
            meglio separarle?&quot;
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              backgroundColor: m.role === "user" ? colors.primaryMuted : colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: spacing.sm,
            }}
          >
            <p style={{ fontSize: font.size.sm, color: colors.textPrimary, whiteSpace: "pre-wrap" }}>{m.content}</p>
            <CitationsList citations={m.citations} />
          </div>
        ))}
        {sending && <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>Sto cercando/rispondendo…</p>}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p style={{ fontSize: font.size.xs, color: colors.danger, marginTop: spacing.xs }}>{error}</p>
      )}

      <form onSubmit={handleSend} className="flex" style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scrivi una domanda…"
          disabled={sending}
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            backgroundColor: colors.primary,
            color: colors.background,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            opacity: sending || !input.trim() ? 0.6 : 1,
          }}
        >
          Invia
        </button>
      </form>
    </div>
  );
}
