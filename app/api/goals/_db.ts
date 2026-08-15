// ============================================================
// IterUp — helper query builder per la tabella goals
// ------------------------------------------------------------
// WORKAROUND TIPI: vedi nota identica in /app/api/habits/_db.ts.
// La versione installata di @supabase/postgrest-js richiede il
// campo `Relationships` per tabella nel tipo Database (assente nel
// contratto congelato /lib/types.ts), altrimenti insert()/update()/
// select() risolvono a `never` solo a livello di tipi. Isoliamo qui
// il cast e ritipiamo esplicitamente i risultati negli endpoint.
// ============================================================

import { supabaseServer } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function goalsTable(): any {
  return supabaseServer.from("goals");
}
