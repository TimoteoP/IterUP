// ============================================================
// IterUp — GET/PATCH /api/self-talk/entries/[id]
// ------------------------------------------------------------
// GET   -> entry + tag (user+llm) + sessione di reframe se esiste.
// PATCH { guidedSessionStarted: true } -> segna l'avvio della
//         sessione guidata (vedi PRD-addendum-negative-self-talk.md
//         sezione 4, step 2/3). Nessun altro campo aggiornabile qui.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { data: entry, error } = await supabaseServer
    .from("self_talk_entries")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!entry) {
    return NextResponse.json({ error: "Entry non trovata." }, { status: 404 });
  }

  const [{ data: tags }, { data: reframeSession }] = await Promise.all([
    supabaseServer.from("distortion_tags").select("*").eq("entry_id", params.id),
    supabaseServer.from("reframe_sessions").select("*").eq("entry_id", params.id).maybeSingle(),
  ]);

  return NextResponse.json({ entry: { ...entry, tags: tags ?? [] }, reframeSession: reframeSession ?? null });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (body?.guidedSessionStarted !== true) {
    return NextResponse.json({ error: "Solo guidedSessionStarted: true è supportato." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("self_talk_entries")
    .update({ guided_session_started: true })
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}
