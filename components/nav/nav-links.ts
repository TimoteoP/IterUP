// Elenco condiviso dei link di navigazione dello shell IterUp.
//
// "/" è la dashboard (panoramica di tutti i moduli attivi): sostituisce
// l'ex link "/statistiche", mai costruito come pagina separata.

export interface NavLink {
  href: string;
  label: string;
  /** Emoji usata come icona — niente icon library esterna (vedi CLAUDE.md). */
  icon: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: "📊" },
  { href: "/diario", label: "Diario", icon: "🍽️" },
  { href: "/misure", label: "Misure", icon: "📏" },
  { href: "/abitudini", label: "Abitudini", icon: "✅" },
  { href: "/pensieri", label: "Pensieri", icon: "💭" },
  { href: "/obiettivi", label: "Obiettivi", icon: "🎯" },
  { href: "/attivita", label: "Attività", icon: "🏃" },
  { href: "/impostazioni", label: "Impostazioni", icon: "⚙️" },
];

/**
 * Un link è "attivo" se il pathname corrente coincide o è una sotto-route
 * (es. /diario/2026-08-15 attiva il link /diario). "/" fa eccezione: non
 * deve restare attivo per ogni sotto-route (altrimenti sarebbe sempre "on").
 */
export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
