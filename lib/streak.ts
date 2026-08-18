// ============================================================
// IterUp — calcolo streak (giorni consecutivi completati)
// ------------------------------------------------------------
// Funzione pura, estratta da app/api/dashboard/route.ts perché
// riusata anche da app/api/goals/route.ts per i goal di tipo
// habit_streak (vedi PRD-addendum-hardening-completamento.md A6).
// ============================================================

/**
 * Streak corrente = giorni consecutivi completati, contando
 * all'indietro da oggi. Un giorno non ancora loggato non spezza lo
 * streak (si assume "in corso"); un giorno loggato ma non completato
 * lo spezza (streak = 0).
 *
 * @param completionByDate mappa data (YYYY-MM-DD) -> completato o meno
 * @param todayIso data di oggi (YYYY-MM-DD)
 */
export function calculateStreak(completionByDate: Map<string, boolean>, todayIso: string): number {
  const hasLogToday = completionByDate.has(todayIso);
  const completedToday = completionByDate.get(todayIso) === true;

  if (hasLogToday && !completedToday) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date(todayIso + "T00:00:00Z");
  if (!(hasLogToday && completedToday)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (completionByDate.get(cursor.toISOString().slice(0, 10)) === true) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
