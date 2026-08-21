"use client";

// ============================================================
// IterUp — pagina di login
// ------------------------------------------------------------
// Unico campo password (nessun account/username: app a singolo
// utente). Su successo, il cookie di sessione è già impostato da
// /api/login (httpOnly, il browser lo allega da solo da qui in poi):
// basta navigare alla pagina richiesta in origine (?next=...) o alla
// home.
// ============================================================

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors, spacing, radius, font } from "@/lib/design-tokens";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Password errata.");
      }
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xs flex-col"
      style={{ gap: spacing.md }}
    >
      <div className="text-center" style={{ marginBottom: spacing.md }}>
        <span
          aria-hidden="true"
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center"
          style={{
            backgroundColor: colors.primary,
            color: colors.background,
            borderRadius: radius.md,
            fontWeight: font.weight.bold,
            fontSize: font.size.lg,
          }}
        >
          IU
        </span>
        <h1 style={{ fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.textPrimary }}>
          IterUp
        </h1>
      </div>

      <div>
        <label
          htmlFor="password"
          style={{
            color: colors.textSecondary,
            fontSize: font.size.sm,
            fontWeight: font.weight.medium,
            marginBottom: spacing.xs,
            display: "block",
          }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          required
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: font.size.md,
            width: "100%",
          }}
        />
      </div>

      {error && (
        <p style={{ color: colors.danger, fontSize: font.size.sm }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !password}
        style={{
          backgroundColor: colors.primary,
          color: colors.background,
          border: "none",
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting || !password ? 0.7 : 1,
        }}
      >
        {submitting ? "Accesso…" : "Entra"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main
      className="flex min-h-dvh w-full items-center justify-center"
      style={{ backgroundColor: colors.background, padding: spacing.lg }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
