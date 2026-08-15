// ============================================================
// IterUp — workaround locale per una limitazione di lib/types.ts
// ------------------------------------------------------------
// lib/types.ts (contratto congelato, vedi CLAUDE.md regola 2) è
// scritto a mano e alle singole tabelle manca il campo
// `Relationships: GenericRelationship[]` che la versione installata
// di @supabase/supabase-js (2.112.x) usa internamente per tipizzare
// `.insert()`, `.single()` e `.maybeSingle()`. Senza quel campo,
// TypeScript risolve quei metodi a `never` (verificato con un repro
// minimo: persino un insert con un Database scritto a mano identico
// a lib/types.ts ma senza Relationships fallisce allo stesso modo).
//
// Non possiamo modificare lib/types.ts da qui (contratto congelato),
// quindi ricostruiamo localmente — solo a livello di tipi, il client
// a runtime è lo stesso `supabaseServer` — un Database "patchato" con
// `Relationships: []` per tabella. Le query con join (`foods(...)`)
// continuano a usare `.returns<...>()` esplicito perché un array
// vuoto di Relationships non basta a tipizzare correttamente l'embed.
//
// SEGNALATO al supervisore: questo probabilmente blocca allo stesso
// modo qualunque altro modulo che usi `.insert()/.update()/.single()`
// contro lib/types.ts così com'è. La fix definitiva è rigenerare
// lib/types.ts aggiungendo `Relationships: []` (o i riferimenti FK
// reali) ad ogni tabella.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as BaseDatabase } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";

type WithRelationships<T> = {
  [K in keyof T]: T[K] extends { Row: unknown; Insert: unknown; Update: unknown }
    ? T[K] & { Relationships: [] }
    : T[K];
};

type PatchedDatabase = Omit<BaseDatabase, "public"> & {
  public: Omit<BaseDatabase["public"], "Tables"> & {
    Tables: WithRelationships<BaseDatabase["public"]["Tables"]>;
  };
};

export const typedSupabase = supabaseServer as unknown as SupabaseClient<PatchedDatabase>;
