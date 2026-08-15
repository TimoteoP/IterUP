// ============================================================
// IterUp — API route: Misure corporee (body_metrics)
// ------------------------------------------------------------
// GET  → storico misurazioni dell'utente corrente, più recenti prima
// POST → crea/aggiorna una misurazione per una data (upsert su
//        unique(user_id, recorded_at): niente errore di duplicato
//        se si inserisce due volte lo stesso giorno, l'ultimo
//        inserimento vince).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { TablesInsert } from "@/lib/types";
import { validateBodyMetricsPayload, type BodyMetricsPayload } from "./validation";

// Evita che Next metta in cache le risposte fetch di supabase-js: lo
// storico deve riflettere sempre l'ultimo stato dopo un upsert/delete.
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("body_metrics")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("recorded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: BodyMetricsPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo della richiesta non valido (JSON atteso)." },
      { status: 400 }
    );
  }

  const { errors, recorded_at, weight_kg, neck_cm, chest_cm, waist_cm, thigh_cm } =
    validateBodyMetricsPayload(body);

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const payload: TablesInsert<"body_metrics"> = {
    user_id: CURRENT_USER_ID,
    recorded_at,
    weight_kg,
    neck_cm,
    chest_cm,
    waist_cm,
    thigh_cm,
  };

  // Upsert: rispetta il vincolo unique(user_id, recorded_at). Se esiste già
  // una misurazione per questa data la sovrascrive invece di fallire.
  //
  // NOTA: il cast a `any` sul builder qui sotto è un workaround mirato per un
  // problema di compatibilità tra /lib/types.ts (contratto congelato, non
  // modificabile da questo modulo) e la versione installata di
  // @supabase/supabase-js (2.112.3): il postgrest-js sottostante richiede che
  // ogni tabella in Database["public"]["Tables"] includa un campo
  // `Relationships: GenericRelationship[]`, assente nel nostro lib/types.ts.
  // Questo fa collassare a `never` l'inferenza dei tipi per QUALSIASI
  // .insert()/.upsert() su QUALSIASI tabella in tutto il progetto (non solo
  // qui) — segnalato al supervisore, va risolto a livello di contratto
  // condiviso (aggiungere `Relationships: []` a ogni tabella in
  // lib/types.ts, oppure pinnare una versione di @supabase/supabase-js
  // compatibile con lo schema attuale). Il payload resta comunque validato
  // a runtime da validateBodyMetricsPayload() sopra.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseServer.from("body_metrics") as any)
    .upsert([payload], { onConflict: "user_id,recorded_at" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
