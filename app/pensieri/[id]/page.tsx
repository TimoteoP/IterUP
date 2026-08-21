"use client";

// ============================================================
// IterUp — Pensieri: sessione guidata (thought record CBT)
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 4, step 3-6.
// Implementato come un unico form scorrevole (non un wizard a passi
// bloccanti): stesso contenuto dei passaggi CBT descritti
// nell'addendum, in ordine, con "consider the opposite" obbligatorio
// prima di poter salvare — scelta pragmatica che resta fedele ai
// contenuti richiesti senza la complessità di uno stepper con
// stato back/forward.
//
// Le distorsioni suggerite dall'AI alla cattura non sono mai
// modificabili/cancellabili qui (vedi addendum sezione 9, "Fuori
// scope": integrità storica) — l'utente può solo aggiungerne altre.
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import { apiFetch } from "@/lib/api-client";
import { DISTORTION_TYPES, distortionLabel, themeLabel } from "@/lib/self-talk-taxonomy";

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

interface ReframeSession {
  evidence_for: string | null;
  evidence_against: string | null;
  consider_opposite: string;
  reframe_text: string | null;
  mood_after: number | null;
}

const textareaStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: spacing.sm,
  fontSize: font.size.sm,
  width: "100%",
  resize: "vertical",
};

const labelStyle: React.CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: colors.textSecondary,
  display: "block",
  marginBottom: spacing.xs,
};

export default function PensieroDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [reframeSession, setReframeSession] = useState<ReframeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evidenceFor, setEvidenceFor] = useState("");
  const [evidenceAgainst, setEvidenceAgainst] = useState("");
  const [considerOpposite, setConsiderOpposite] = useState("");
  const [reframeText, setReframeText] = useState("");
  const [includeMoodAfter, setIncludeMoodAfter] = useState(false);
  const [moodAfter, setMoodAfter] = useState(5);
  const [addingDistortion, setAddingDistortion] = useState("");
  const [proposing, setProposing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Il reframe resta sempre modificabile, anche a sessione completata
  // (vedi PRD-addendum-negative-self-talk.md sezione 8, guardrail 4:
  // "mai imposto come la verità corretta") — non è un one-shot.
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/api/self-talk/entries/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento");
        setEntry(json.entry);
        setReframeSession(json.reframeSession);

        if (!json.entry.guided_session_started) {
          await apiFetch(`/api/self-talk/entries/${params.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guidedSessionStarted: true }),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  function startEditing() {
    setEvidenceFor(reframeSession?.evidence_for ?? "");
    setEvidenceAgainst(reframeSession?.evidence_against ?? "");
    setConsiderOpposite(reframeSession?.consider_opposite ?? "");
    setReframeText(reframeSession?.reframe_text ?? "");
    setIncludeMoodAfter(reframeSession?.mood_after !== null && reframeSession?.mood_after !== undefined);
    setMoodAfter(reframeSession?.mood_after ?? 5);
    setError(null);
    setIsEditing(true);
  }

  async function addDistortion() {
    if (!addingDistortion) return;
    const res = await apiFetch(`/api/self-talk/entries/${params.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distortionType: addingDistortion }),
    });
    if (res.ok) {
      const json = await res.json();
      setEntry((prev) => (prev ? { ...prev, tags: [...prev.tags, json.tag] } : prev));
      setAddingDistortion("");
    }
  }

  async function handlePropose() {
    if (!considerOpposite.trim()) {
      setError("Rispondi prima a \"cosa staresti ignorando?\": è l'unico passaggio obbligatorio.");
      return;
    }
    setError(null);
    setProposing(true);
    try {
      const res = await apiFetch(`/api/self-talk/entries/${params.id}/reframe/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distortions: entry?.tags.map((t) => t.distortion_type) ?? [],
          evidenceFor,
          evidenceAgainst,
          considerOpposite,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nella generazione del reframe");
      setReframeText(json.reframeText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setProposing(false);
    }
  }

  async function handleSave() {
    if (!considerOpposite.trim()) {
      setError("Rispondi prima a \"cosa staresti ignorando?\": è l'unico passaggio obbligatorio.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/self-talk/entries/${params.id}/reframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceFor,
          evidenceAgainst,
          considerOpposite,
          reframeText,
          moodAfter: includeMoodAfter ? moodAfter : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nel salvataggio");

      if (isEditing) {
        setReframeSession(json.reframeSession);
        setIsEditing(false);
        setSaving(false);
      } else {
        router.push("/pensieri");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ backgroundColor: colors.background, minHeight: "100vh", padding: spacing.lg }}>
        <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>
      </main>
    );
  }

  if (!entry) {
    return (
      <main style={{ backgroundColor: colors.background, minHeight: "100vh", padding: spacing.lg }}>
        <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error ?? "Pensiero non trovato."}</p>
      </main>
    );
  }

  const availableDistortions = DISTORTION_TYPES.filter((d) => !entry.tags.some((t) => t.distortion_type === d.value));

  return (
    <main className="min-h-screen w-full" style={{ backgroundColor: colors.background, color: colors.textPrimary }}>
      <div className="mx-auto flex max-w-2xl flex-col" style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Link href="/pensieri" style={{ fontSize: font.size.xs, color: colors.accent }}>
          ← Torna ai Pensieri
        </Link>

        <section
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <p style={{ fontSize: font.size.md, color: colors.textPrimary }}>{entry.raw_text}</p>
          <div className="flex flex-wrap items-center" style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            {entry.theme && (
              <span style={{ fontSize: font.size.xs, color: colors.accent, backgroundColor: colors.primaryMuted, borderRadius: radius.full, padding: "2px 8px" }}>
                {themeLabel(entry.theme)}
              </span>
            )}
            {entry.tags.map((tag) => (
              <span
                key={tag.id}
                title={tag.source === "llm" ? "Suggerito dall'AI" : "Aggiunto da te"}
                style={{ fontSize: font.size.xs, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: radius.full, padding: "2px 8px" }}
              >
                {distortionLabel(tag.distortion_type)}
                {tag.source === "llm" ? " 🤖" : ""}
              </span>
            ))}
          </div>

          {(!reframeSession || isEditing) && availableDistortions.length > 0 && (
            <div className="flex items-center" style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              <select
                value={addingDistortion}
                onChange={(e) => setAddingDistortion(e.target.value)}
                style={{ ...textareaStyle, width: "auto", padding: `${spacing.xs} ${spacing.sm}`, fontSize: font.size.xs }}
              >
                <option value="">+ Aggiungi una distorsione che riconosci...</option>
                {availableDistortions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              {addingDistortion && (
                <button type="button" onClick={addDistortion} style={{ fontSize: font.size.xs, color: colors.accent }}>
                  Aggiungi
                </button>
              )}
            </div>
          )}
        </section>

        {reframeSession && !isEditing ? (
          <section
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.lg }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: spacing.md }}>
              <h2 style={{ fontSize: font.size.md, fontWeight: font.weight.semibold }}>Thought record completato</h2>
              <button type="button" onClick={startEditing} style={{ fontSize: font.size.xs, color: colors.accent }}>
                Modifica
              </button>
            </div>
            <div className="flex flex-col" style={{ gap: spacing.md }}>
              {reframeSession.evidence_for && (
                <div>
                  <span style={labelStyle}>Evidenza a favore</span>
                  <p style={{ fontSize: font.size.sm }}>{reframeSession.evidence_for}</p>
                </div>
              )}
              {reframeSession.evidence_against && (
                <div>
                  <span style={labelStyle}>Evidenza contro</span>
                  <p style={{ fontSize: font.size.sm }}>{reframeSession.evidence_against}</p>
                </div>
              )}
              <div>
                <span style={labelStyle}>Cosa ignoreresti cercando solo conferme</span>
                <p style={{ fontSize: font.size.sm }}>{reframeSession.consider_opposite}</p>
              </div>
              {reframeSession.reframe_text && (
                <div>
                  <span style={labelStyle}>Reframe</span>
                  <p style={{ fontSize: font.size.sm, fontWeight: font.weight.medium }}>{reframeSession.reframe_text}</p>
                </div>
              )}
              {entry.mood_before !== null && reframeSession.mood_after !== null && (
                <p style={{ fontSize: font.size.xs, color: colors.textMuted }}>
                  Umore: {entry.mood_before}/10 → {reframeSession.mood_after}/10
                </p>
              )}
            </div>
          </section>
        ) : (
          <section
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.lg }}
          >
            <div className="flex flex-col" style={{ gap: spacing.md }}>
              <div>
                <label style={labelStyle} htmlFor="evidenceFor">
                  Che prova hai a favore di questo pensiero?
                </label>
                <textarea id="evidenceFor" rows={2} style={textareaStyle} value={evidenceFor} onChange={(e) => setEvidenceFor(e.target.value)} />
              </div>

              <div>
                <label style={labelStyle} htmlFor="evidenceAgainst">
                  Che prova hai contro?
                </label>
                <textarea id="evidenceAgainst" rows={2} style={textareaStyle} value={evidenceAgainst} onChange={(e) => setEvidenceAgainst(e.target.value)} />
              </div>

              <div>
                <label style={labelStyle} htmlFor="considerOpposite">
                  Se stessi cercando solo conferme a questo pensiero, cosa staresti ignorando? *
                </label>
                <textarea
                  id="considerOpposite"
                  rows={2}
                  style={textareaStyle}
                  value={considerOpposite}
                  onChange={(e) => setConsiderOpposite(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Reframe</label>
                {reframeText ? (
                  <textarea rows={3} style={textareaStyle} value={reframeText} onChange={(e) => setReframeText(e.target.value)} />
                ) : (
                  <button
                    type="button"
                    onClick={handlePropose}
                    disabled={proposing}
                    style={{
                      fontSize: font.size.sm,
                      color: colors.accent,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      padding: `${spacing.xs} ${spacing.md}`,
                      opacity: proposing ? 0.6 : 1,
                    }}
                  >
                    {proposing ? "Genero una proposta…" : "Proponimi un reframe"}
                  </button>
                )}
                <p style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.xs }}>
                  È solo un punto di partenza: modificalo finché non lo senti tuo.
                </p>
              </div>

              <div className="flex items-center" style={{ gap: spacing.sm }}>
                <label className="flex items-center" style={{ gap: spacing.xs, fontSize: font.size.xs, color: colors.textSecondary }}>
                  <input type="checkbox" checked={includeMoodAfter} onChange={(e) => setIncludeMoodAfter(e.target.checked)} />
                  Umore adesso (opzionale)
                </label>
                {includeMoodAfter && (
                  <>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={moodAfter}
                      onChange={(e) => setMoodAfter(Number(e.target.value))}
                      style={{ accentColor: colors.primary, flex: 1, maxWidth: 160 }}
                    />
                    <span style={{ fontSize: font.size.xs, color: colors.textMuted, minWidth: "2.5em" }}>{moodAfter}/10</span>
                  </>
                )}
              </div>

              {error && <p style={{ fontSize: font.size.xs, color: colors.danger }}>{error}</p>}

              <div className="flex items-center" style={{ gap: spacing.sm }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.background,
                    borderRadius: radius.md,
                    padding: `${spacing.sm} ${spacing.lg}`,
                    fontSize: font.size.sm,
                    fontWeight: font.weight.semibold,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Salvataggio…" : "Salva"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setError(null);
                    }}
                    disabled={saving}
                    style={{
                      backgroundColor: "transparent",
                      border: `1px solid ${colors.border}`,
                      color: colors.textSecondary,
                      borderRadius: radius.md,
                      padding: `${spacing.sm} ${spacing.lg}`,
                      fontSize: font.size.sm,
                    }}
                  >
                    Annulla
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
