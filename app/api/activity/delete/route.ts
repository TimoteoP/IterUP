// ============================================================
// IterUp — Eliminazione riga attività (A6)
// ------------------------------------------------------------
// DELETE /api/activity/delete?id=<uuid>
// Usata dallo storico in /app/attivita per correggere errori di
// inserimento manuale.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { errorResponse } from "../_utils";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return errorResponse("query param 'id' mancante", 400);
  }

  const { error } = await supabaseServer
    .from("activity_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", CURRENT_USER_ID);

  if (error) {
    return errorResponse(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
