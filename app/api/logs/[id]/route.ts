// ============================================================
// IterUp — DELETE /api/logs/[id]
// ------------------------------------------------------------
// Rimuove un singolo daily_log, filtrando sia per id sia per
// CURRENT_USER_ID (in modo che non si possa mai cancellare un log
// di un altro user_id anche se in futuro ce ne fosse più di uno).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "id mancante" }, { status: 400 });
  }

  const { error, count } = await supabaseServer
    .from("daily_logs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", CURRENT_USER_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: "Log non trovato" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
