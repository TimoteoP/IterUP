// ============================================================
// IterUp — Elenco attività (A6)
// ------------------------------------------------------------
// GET /api/activity/list?limit=60
// Ritorna le righe di activity_logs dell'utente corrente, ordinate per
// data decrescente (poi created_at decrescente per stabilità).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { errorResponse } from "../_utils";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number(limitParam) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 60;

  const { data, error } = await supabaseServer
    .from("activity_logs")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("recorded_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(error.message, 500);
  }
  return NextResponse.json({ data: data ?? [] });
}
