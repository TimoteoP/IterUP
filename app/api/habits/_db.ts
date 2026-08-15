// ============================================================
// IterUp — helper query builder per le tabelle habits/habit_logs
// ------------------------------------------------------------
// WORKAROUND TIPI: la versione installata di @supabase/postgrest-js
// (2.x) richiede che ogni tabella del tipo Database esponga un campo
// `Relationships: GenericRelationship[]`, assente in /lib/types.ts
// (file congelato, vedi CLAUDE.md regola 2). Senza quel campo,
// insert()/update()/upsert()/select() risolvono il loro parametro/
// risultato a `never` a livello di tipi (nessun impatto runtime).
// Non modifichiamo il contratto condiviso: isoliamo qui il cast e
// ritipiamo esplicitamente i risultati nei singoli endpoint.
// Segnalato al supervisore: lib/types.ts andrebbe rigenerato con
// `Relationships: []` per tabella per risolvere alla radice.
// ============================================================

import { supabaseServer } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function habitsTable(): any {
  return supabaseServer.from("habits");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function habitLogsTable(): any {
  return supabaseServer.from("habit_logs");
}
