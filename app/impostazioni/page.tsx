"use client";

// ============================================================
// IterUp — Impostazioni / Profilo
// ------------------------------------------------------------
// Unica pagina per creare il profilo al primo avvio E per
// modificarlo in seguito (non è un one-shot immutabile, vedi
// PRD-addendum-onboarding-form.md sezione 1) — sostituisce l'ex
// pagina /onboarding, che duplicava questa. Se non esiste ancora un
// profilo, il form parte vuoto e il salvataggio porta al diario;
// altrimenti è precompilato e il salvataggio resta su questa pagina.
// Gestisce anche l'elenco integratori posseduti (sezione 5.1).
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, spacing, radius, font } from "@/lib/design-tokens";
import ProfileForm, { PROFILE_FORM_INITIAL_STATE, type ProfileFormState } from "./ProfileForm";
import SupplementsManager from "./SupplementsManager";
import SupplementChat from "./SupplementChat";
import CoachPreferences from "./CoachPreferences";
import { apiFetch } from "@/lib/api-client";

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.lg,
};

export default function ImpostazioniPage() {
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<ProfileFormState | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await apiFetch("/api/export");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore nell'esportazione");

      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iterup-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/profile");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Errore nel caricamento del profilo");

        const p = json.profile;
        setIsFirstRun(!p);
        setInitialValues({
          fullName: p?.full_name ?? "",
          sex: p?.sex ?? "",
          birthDate: p?.birth_date ?? "",
          heightCm: p?.height_cm != null ? String(p.height_cm) : "",
          weightKg: json.latestWeightKg != null ? String(json.latestWeightKg) : "",
          activityLevel: p?.activity_level ?? "",
          mode: json.activeMode ?? "",
          dietaryRegime: p?.dietary_regime ?? "mediterraneo",
          customMacroSplit: p?.custom_macro_split ?? null,
          allergies: p?.allergies ?? [],
          preferences: p?.preferences ?? [],
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Errore sconosciuto");
        setIsFirstRun(true);
        setInitialValues(PROFILE_FORM_INITIAL_STATE);
      }
    }
    load();
  }, []);

  function handleSuccess() {
    if (isFirstRun) {
      router.push("/diario");
      return;
    }
    setSaved(true);
  }

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
          <h1 style={{ fontSize: font.size.xl, fontWeight: font.weight.bold }}>
            {isFirstRun ? "Benvenuto su IterUp" : "Impostazioni"}
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginTop: spacing.xs }}>
            {isFirstRun
              ? "Raccontaci qualcosa di te per calcolare il tuo fabbisogno calorico e i tuoi target macro."
              : "Aggiorna il tuo profilo o gestisci i tuoi integratori."}
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
              submitLabel={isFirstRun ? "Calcola il mio piano" : "Salva modifiche"}
              submittingLabel="Salvataggio..."
              onSuccess={handleSuccess}
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

        <section style={cardStyle}>
          <h2
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Chat integratori
          </h2>
          <SupplementChat />
        </section>

        <section style={cardStyle}>
          <h2
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Coach comportamentale
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginBottom: spacing.md }}>
            Attiva o disattiva i singoli tipi di messaggi che il coach genera in base ai tuoi dati.
          </p>
          <CoachPreferences />
        </section>

        <section style={cardStyle}>
          <h2
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              marginBottom: spacing.md,
            }}
          >
            Backup dati
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: font.size.sm, marginBottom: spacing.md }}>
            Scarica un JSON con tutto il tuo storico (profilo, diario, misure, attività,
            abitudini, obiettivi, integratori). Nessun account, nessun recupero automatico:
            questo è l&apos;unica rete di sicurezza.
          </p>
          {exportError && (
            <p style={{ color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.md }}>{exportError}</p>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{
              backgroundColor: colors.surfaceAlt,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              color: colors.textPrimary,
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? "Esportazione…" : "Esporta i miei dati"}
          </button>
        </section>
      </div>
    </main>
  );
}
