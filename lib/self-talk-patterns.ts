// ============================================================
// IterUp — Negative Self-Talk: rilevamento pattern (pure)
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 6: le regole sono
// esplicite, non lasciate all'LLM ("per evitare over-alarming o
// minimizzazione dovuta a variabilità del prompt"). summary_text è
// generato qui da template fissi con i numeri reali, mai da un
// modello linguistico.
//
// NOTA: la voce 'crisis_language' descritta nell'addendum è stata
// esclusa su richiesta esplicita dell'utente (nessun rilevamento o
// messaggio di crisi in questo modulo, vedi schema-migration-010).
// Le soglie sotto sono i default proposti dall'addendum, adottati
// per intero su indicazione dell'utente ("usale per dare indicazioni
// e consigli, settale tu come ritieni più opportuno").
// ============================================================

import type { PatternFlagType, ThemeTag } from "./self-talk-taxonomy";
import { themeLabel } from "./self-talk-taxonomy";

export interface PatternFlagResult {
  flagType: PatternFlagType;
  windowStart: string;
  windowEnd: string;
  summaryText: string;
}

interface EntryForPatterns {
  createdAt: string; // ISO datetime
  theme: ThemeTag | null;
  moodBefore: number | null;
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function withinWindow(entryDate: string, windowStart: string, windowEnd: string): boolean {
  return entryDate >= windowStart && entryDate <= windowEnd;
}

const FREQUENCY_HIGH_WINDOW_DAYS = 7;
const FREQUENCY_HIGH_MIN_COUNT = 8;

/** >= 8 entry nella finestra di 7 giorni con lo stesso theme. */
export function detectFrequencyHigh(entries: EntryForPatterns[], todayIso: string): PatternFlagResult | null {
  const windowStart = addDaysIso(todayIso, -(FREQUENCY_HIGH_WINDOW_DAYS - 1));
  const inWindow = entries.filter((e) => withinWindow(dateOnly(e.createdAt), windowStart, todayIso) && e.theme);

  const countByTheme = new Map<ThemeTag, number>();
  for (const e of inWindow) {
    if (!e.theme) continue;
    countByTheme.set(e.theme, (countByTheme.get(e.theme) ?? 0) + 1);
  }

  let topTheme: ThemeTag | null = null;
  let topCount = 0;
  for (const [theme, count] of Array.from(countByTheme)) {
    if (count > topCount) {
      topCount = count;
      topTheme = theme;
    }
  }

  if (!topTheme || topCount < FREQUENCY_HIGH_MIN_COUNT) return null;

  return {
    flagType: "frequency_high",
    windowStart,
    windowEnd: todayIso,
    summaryText: `Negli ultimi ${FREQUENCY_HIGH_WINDOW_DAYS} giorni hai registrato ${topCount} pensieri sul tema "${themeLabel(topTheme)}".`,
  };
}

const INTENSITY_HIGH_WINDOW_DAYS = 14;
const INTENSITY_HIGH_MIN_COUNT = 5;
const INTENSITY_HIGH_MAX_AVG_MOOD = 3;

/** media mood_before <= 3 su >= 5 entry nella finestra di 14 giorni. */
export function detectIntensityHigh(entries: EntryForPatterns[], todayIso: string): PatternFlagResult | null {
  const windowStart = addDaysIso(todayIso, -(INTENSITY_HIGH_WINDOW_DAYS - 1));
  const inWindow = entries.filter(
    (e) => withinWindow(dateOnly(e.createdAt), windowStart, todayIso) && e.moodBefore !== null
  );

  if (inWindow.length < INTENSITY_HIGH_MIN_COUNT) return null;

  const avgMood = inWindow.reduce((sum, e) => sum + (e.moodBefore as number), 0) / inWindow.length;
  if (avgMood > INTENSITY_HIGH_MAX_AVG_MOOD) return null;

  return {
    flagType: "intensity_high",
    windowStart,
    windowEnd: todayIso,
    summaryText: `Negli ultimi ${INTENSITY_HIGH_WINDOW_DAYS} giorni l'umore medio prima di scrivere è stato ${avgMood.toFixed(1)}/10, su ${inWindow.length} pensieri registrati.`,
  };
}

const THEME_CONCENTRATION_WINDOW_DAYS = 30;
const THEME_CONCENTRATION_MIN_COUNT = 5;
const THEME_CONCENTRATION_MIN_PCT = 60;

/** >= 60% delle entry in 30 giorni concentrate su un singolo theme (con un minimo di entry per evitare falsi positivi su campioni piccoli). */
export function detectThemeConcentration(entries: EntryForPatterns[], todayIso: string): PatternFlagResult | null {
  const windowStart = addDaysIso(todayIso, -(THEME_CONCENTRATION_WINDOW_DAYS - 1));
  const inWindow = entries.filter((e) => withinWindow(dateOnly(e.createdAt), windowStart, todayIso) && e.theme);

  if (inWindow.length < THEME_CONCENTRATION_MIN_COUNT) return null;

  const countByTheme = new Map<ThemeTag, number>();
  for (const e of inWindow) {
    if (!e.theme) continue;
    countByTheme.set(e.theme, (countByTheme.get(e.theme) ?? 0) + 1);
  }

  let topTheme: ThemeTag | null = null;
  let topCount = 0;
  for (const [theme, count] of Array.from(countByTheme)) {
    if (count > topCount) {
      topCount = count;
      topTheme = theme;
    }
  }

  if (!topTheme) return null;
  const pct = Math.round((topCount / inWindow.length) * 100);
  if (pct < THEME_CONCENTRATION_MIN_PCT) return null;

  return {
    flagType: "theme_concentration",
    windowStart,
    windowEnd: todayIso,
    summaryText: `Negli ultimi ${THEME_CONCENTRATION_WINDOW_DAYS} giorni il ${pct}% dei tuoi pensieri registrati riguarda il tema "${themeLabel(topTheme)}" (${topCount} su ${inWindow.length}).`,
  };
}

/** Valuta tutti e 3 i pattern, ritorna quelli che scattano (0-3 risultati). */
export function detectAllPatterns(entries: EntryForPatterns[], todayIso: string): PatternFlagResult[] {
  return [detectFrequencyHigh(entries, todayIso), detectIntensityHigh(entries, todayIso), detectThemeConcentration(entries, todayIso)].filter(
    (r): r is PatternFlagResult => r !== null
  );
}
