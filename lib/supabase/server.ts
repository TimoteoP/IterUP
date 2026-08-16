// ============================================================
// IterUp — client Supabase server-side (service role)
// ------------------------------------------------------------
// CONGELATO dopo la Fase 0 (vedi CLAUDE.md regola 2).
//
// Usa questo client SOLO dentro /app/api/**/route.ts. Bypassa la RLS
// tramite la service role key, quindi ogni query deve filtrare
// esplicitamente su CURRENT_USER_ID (vedi /lib/config.ts) invece di
// affidarsi ad auth.uid(). Non importare mai questo file da un
// componente "use client".
// ============================================================

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

export const supabaseServer = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    // Next.js patcha il `fetch` globale e mette in cache le richieste per
    // URL, anche nelle route handler con `dynamic = "force-dynamic"` (quel
    // flag disabilita il rendering statico della route, non la Data Cache
    // dei singoli fetch). Senza questo, due chiamate a supabase-js con la
    // stessa select/filtro possono restituire una risposta cachata stale
    // invece di leggere lo stato reale del DB. `cache: "no-store"` disattiva
    // la Data Cache di Next per ogni richiesta fatta da questo client.
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  },
});
