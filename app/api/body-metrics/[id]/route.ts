// ============================================================
// IterUp — API route: cancellazione singola misurazione
// ------------------------------------------------------------
// DELETE /api/body-metrics/:id — elimina la misurazione con quel id,
// filtrando sempre per user_id (mai fidarsi solo dell'id ricevuto).
// ============================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireWriteAuth } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = requireWriteAuth(request);
  if (authError) return authError;

  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Id mancante." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("body_metrics")
    .delete()
    .eq("id", id)
    .eq("user_id", CURRENT_USER_ID)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Misurazione non trovata." }, { status: 404 });
  }

  return NextResponse.json({ data });
}
