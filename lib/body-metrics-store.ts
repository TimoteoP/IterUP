// ============================================================
// IterUp — upsert "merge-aware" su body_metrics
// ------------------------------------------------------------
// body_metrics è condivisa tra il modulo Misure (peso/collo/petto/
// vita/coscia) e la Bussola di Ricomposizione (fianchi/kcal periodo/
// percezione soggettiva): due form diversi possono scrivere lo stesso
// giorno. Un upsert "cieco" (che manda sempre tutti i campi, null
// compresi, per quelli non presenti nel form corrente) cancellerebbe
// i campi scritti dall'altro form. Questo helper legge la riga
// esistente per la data, applica solo i campi effettivamente presenti
// nel patch, e fa upsert del risultato.
// ============================================================

import { supabaseServer } from "./supabase/server";
import type { Tables, TablesInsert } from "./types";

export async function upsertBodyMetricsForDate(
  userId: string,
  recordedAt: string,
  patch: Partial<Omit<TablesInsert<"body_metrics">, "user_id" | "recorded_at" | "id" | "created_at">>
): Promise<{ data: Tables<"body_metrics"> | null; error: { message: string } | null }> {
  const { data: existing, error: fetchError } = await supabaseServer
    .from("body_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("recorded_at", recordedAt)
    .maybeSingle();

  if (fetchError) {
    return { data: null, error: fetchError };
  }

  const merged: TablesInsert<"body_metrics"> = {
    ...(existing ?? {}),
    ...patch,
    user_id: userId,
    recorded_at: recordedAt,
  };
  // Non rimandare id/created_at nel payload di upsert: li gestisce il DB.
  delete (merged as { id?: string }).id;
  delete (merged as { created_at?: string }).created_at;

  const { data, error } = await supabaseServer
    .from("body_metrics")
    .upsert(merged, { onConflict: "user_id,recorded_at" })
    .select()
    .single();

  return { data, error };
}
