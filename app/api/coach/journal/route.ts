// ============================================================
// IterUp — GET/POST /api/coach/journal
// ------------------------------------------------------------
// "Note del giorno" (vedi PRD-addendum-coach-comportamentale.md
// sezione 5) — distinta dal diario alimentare, letta dal rituale
// serale. GET ?date=YYYY-MM-DD (default oggi) ritorna la voce o null
// (vuoto è uno stato legittimo). POST upsert su unique(user_id,
// entry_date): un contenuto vuoto cancella la voce del giorno
// (l'utente può "ritirare" ciò che ha scritto).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import type { TablesInsert } from "@/lib/types";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const date = request.nextUrl.searchParams.get("date") ?? todayIso();

  const { data, error } = await supabaseServer
    .from("journal_entries")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .eq("entry_date", date)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data ?? null });
}

export async function POST(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const entryDate = typeof body?.entry_date === "string" && body.entry_date ? body.entry_date : todayIso();

  if (!content) {
    const { error } = await supabaseServer
      .from("journal_entries")
      .delete()
      .eq("user_id", CURRENT_USER_ID)
      .eq("entry_date", entryDate);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ entry: null });
  }

  const payload: TablesInsert<"journal_entries"> = {
    user_id: CURRENT_USER_ID,
    entry_date: entryDate,
    content,
  };

  const { data, error } = await supabaseServer
    .from("journal_entries")
    .upsert(payload, { onConflict: "user_id,entry_date" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}
