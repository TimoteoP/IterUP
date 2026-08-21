// ============================================================
// IterUp — POST /api/self-talk/entries/[id]/tags
// ------------------------------------------------------------
// L'utente conferma/aggiunge una distorsione (source='user'), vedi
// PRD-addendum-negative-self-talk.md sezione 2: ogni tag ha
// source 'user'|'llm', per misurare la divergenza nel tempo tra
// auto-percezione e classificazione del modello (dashboard, sez. 7).
// body: { distortionType: <uno dei 10 valori fissi> }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import { isDistortionType } from "@/lib/self-talk-taxonomy";
import type { TablesInsert } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const distortionType = body?.distortionType;
  if (!isDistortionType(distortionType)) {
    return NextResponse.json({ error: "distortionType non valido." }, { status: 400 });
  }

  const { data: entry } = await supabaseServer
    .from("self_talk_entries")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .maybeSingle();

  if (!entry) {
    return NextResponse.json({ error: "Entry non trovata." }, { status: 404 });
  }

  const insert: TablesInsert<"distortion_tags"> = {
    entry_id: params.id,
    user_id: CURRENT_USER_ID,
    distortion_type: distortionType,
    source: "user",
  };

  const { data, error } = await supabaseServer.from("distortion_tags").insert(insert).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tag: data }, { status: 201 });
}
