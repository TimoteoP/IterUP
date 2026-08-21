// ============================================================
// IterUp — GET/POST /api/coach/daily-focus
// ------------------------------------------------------------
// Le 3 priorità della giornata (vedi
// PRD-addendum-coach-comportamentale.md sezione 4), inserite la sera
// prima o al risveglio. GET ?date=YYYY-MM-DD (default oggi) ritorna
// la riga o null se non ancora compilata (nessun errore: è uno stato
// legittimo, il rituale mattutino ha un fallback su goals/habits).
// POST upsert su unique(user_id, focus_date).
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
    .from("daily_focus")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .eq("focus_date", date)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dailyFocus: data ?? null });
}

export async function POST(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const focusDate = typeof body.focus_date === "string" && body.focus_date ? body.focus_date : todayIso();
  const toNullableText = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const payload: TablesInsert<"daily_focus"> = {
    user_id: CURRENT_USER_ID,
    focus_date: focusDate,
    priority_1: toNullableText(body.priority_1),
    priority_2: toNullableText(body.priority_2),
    priority_3: toNullableText(body.priority_3),
  };

  const { data, error } = await supabaseServer
    .from("daily_focus")
    .upsert(payload, { onConflict: "user_id,focus_date" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dailyFocus: data });
}
