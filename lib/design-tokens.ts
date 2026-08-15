// ============================================================
// IterUp — design tokens condivisi
// ------------------------------------------------------------
// CONGELATO dopo la Fase 0 (vedi CLAUDE.md regola 2).
//
// Ogni modulo importa questi token invece di inventare colori,
// spacing o font. Se serve un nuovo token, segnalalo al supervisore.
// ============================================================

export const colors = {
  background: "#0B0D10",
  surface: "#15181D",
  surfaceAlt: "#1E2229",
  border: "#2A2F38",

  textPrimary: "#F5F6F7",
  textSecondary: "#A3A9B2",
  textMuted: "#6B7280",

  primary: "#4ADE80", // azione principale, progressi positivi
  primaryMuted: "#1F3A2A",

  accent: "#60A5FA", // link, elementi informativi
  warning: "#FBBF24",
  danger: "#F87171",

  macro: {
    kcal: "#F5F6F7",
    protein: "#60A5FA",
    carbs: "#FBBF24",
    fat: "#F87171",
  },
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
} as const;

export const radius = {
  sm: "0.375rem",
  md: "0.75rem",
  lg: "1rem",
  full: "9999px",
} as const;

export const font = {
  sans: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.5rem",
    xxl: "2rem",
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;
