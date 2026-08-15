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
});
