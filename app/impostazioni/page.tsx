"use client";

// ============================================================
// IterUp — Impostazioni / Profilo
// ------------------------------------------------------------
// Permette di rivedere/modificare i dati raccolti in onboarding
// (vedi PRD-addendum-onboarding-form.md sezione 1: non è un one-shot
// immutabile) e gestire l'elenco integratori posseduti (sezione 5.1).
// ============================================================

import { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import ProfileForm, { PROFILE_FORM_INITIAL_STATE, type ProfileFormState } from "../onboarding/ProfileForm";
import SupplementsManager from "./SupplementsManager";

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

export default function ImpostazioniPage() {
  const [initialValues, setInitialValues] = useState<ProfileFormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento del profilo");

        const p = json.profile;
        setInitialValues({
          fullName: p?.full_name ?? "",
          sex: p?.sex ?? "",
          birthDate: p?.birth_date ?? "",
          heightCm: p?.height_cm != null ? String(p.height_cm) : "",
          weightKg: json.latestWeightKg != null ? String(json.latestWeightKg) : "",
          activityLevel: p?.activity_level ?? "",
          mode: json.activeMode ?? "",
          dietaryRegime: p?.dietary_regime ?? "mediterraneo",
          allergies: p?.allergies ?? [],
          preferences: p?.preferences ?? [],
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Errore sconosciuto");
        setInitialValues(PROFILE_FORM_INITIAL_STATE);
      }
    }
    load();
  }, []);

  return (
    <main
      className="min-h-screen w-full"
      style={{ backgroundColor: colors.background, color: colors.textPrimary }}
    >
      <div
        className="mx-auto flex max-w-2xl flex-col"
        style={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <header>
          <h1 style={{ fontSize: font.size.xl, fontWeight: font.weight.bold }}>Impostazioni</h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            Aggiorna il tuo profilo o gestisci i tuoi integratori.
          </p>
        </header>

        <section style={cardStyle}>
          <h2
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Profilo
          </h2>

          {loadError && (
            <p style={{ color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.md }}>
              {loadError}
            </p>
          )}

          {saved && (
            <p
              style={{
                color: colors.primary,
                fontSize: font.size.sm,
                marginBottom: spacing.md,
              }}
            >
              Profilo aggiornato.
            </p>
          )}

          {initialValues ? (
            <ProfileForm
              initialValues={initialValues}
              submitLabel="Salva modifiche"
              submittingLabel="Salvataggio..."
              onSuccess={() => setSaved(true)}
            />
          ) : (
            <p style={{ color: colors.textMuted, fontSize: font.size.sm }}>Caricamento…</p>
          )}
        </section>

        <section style={cardStyle}>
          <h2
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Integratori
          </h2>
          <SupplementsManager />
        </section>
      </div>
    </main>
  );
}
