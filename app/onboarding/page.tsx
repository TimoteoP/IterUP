"use client";

// ============================================================
// IterUp — Onboarding (A1)
// ------------------------------------------------------------
// Primo avvio: raccoglie dati fisici, tipo di dieta, regime,
// allergie/preferenze; salva via /api/onboarding/save (lib/tdee.ts
// per il calcolo TDEE/target). Nessun login: single-user (CLAUDE.md
// regola 1). I dati restano editabili in seguito da /impostazioni
// (vedi PRD-addendum-onboarding-form.md sezione 1: non è un one-shot).
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import ProfileForm from "./ProfileForm";

export default function OnboardingPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  function handleSuccess() {
    setSuccess(true);
    setTimeout(() => {
      router.push("/diario");
    }, 1200);
  }

  return (
    <main
      style={{
        backgroundColor: colors.background,
        minHeight: "100vh",
        color: colors.textPrimary,
        fontFamily: font.sans,
      }}
      className="flex justify-center px-4 py-12"
    >
      <div className="w-full max-w-md" style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.textPrimary }}>
            Benvenuto su IterUp
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            Raccontaci qualcosa di te per calcolare il tuo fabbisogno calorico e i tuoi target macro.
          </p>
        </div>

        {success ? (
          <div
            style={{
              backgroundColor: colors.primaryMuted,
              border: `1px solid ${colors.primary}`,
              borderRadius: radius.lg,
              padding: spacing.lg,
              color: colors.textPrimary,
            }}
          >
            <p style={{ fontWeight: font.weight.semibold, marginBottom: spacing.xs }}>
              Profilo salvato con successo.
            </p>
            <p style={{ color: colors.textSecondary, fontSize: font.size.sm }}>
              Ti stiamo portando al diario alimentare...
            </p>
          </div>
        ) : (
          <ProfileForm
            submitLabel="Calcola il mio piano"
            submittingLabel="Salvataggio..."
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </main>
  );
}
