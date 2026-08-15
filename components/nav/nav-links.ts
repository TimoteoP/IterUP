// Elenco condiviso dei link di navigazione dello shell IterUp.
//
// Nota: /statistiche non è ancora costruita (dipende da A2/A4/A6, Fase 3
// del piano multi-agente in CLAUDE.md) — il link esiste comunque e punterà
// a un 404 finché quel modulo non viene integrato. È atteso.

export interface NavLink {
  href: string;
  label: string;
  /** Emoji usata come icona — niente icon library esterna (vedi CLAUDE.md). */
  icon: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/onboarding", label: "Onboarding", icon: "👋" },
  { href: "/diario", label: "Diario", icon: "🍽️" },
  { href: "/misure", label: "Misure", icon: "📏" },
  { href: "/abitudini", label: "Abitudini", icon: "✅" },
  { href: "/obiettivi", label: "Obiettivi", icon: "🎯" },
  { href: "/attivita", label: "Attività", icon: "🏃" },
  { href: "/statistiche", label: "Statistiche", icon: "📊" },
];

/**
 * Un link è "attivo" se il pathname corrente coincide o è una sotto-route
 * (es. /diario/2026-08-15 attiva il link /diario).
 */
export function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
