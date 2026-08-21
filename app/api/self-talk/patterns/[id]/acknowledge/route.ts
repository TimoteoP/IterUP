// ============================================================
// IterUp — POST /api/self-talk/patterns/[id]/acknowledge
// ------------------------------------------------------------
// Segna un pattern_flag come visto. Nessuna logica aggiuntiva: è
// solo per far sparire il flag dalla vista attiva nella UI.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseServer
    .from("pattern_flags")
    .update({ acknowledged: true })
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flag: data });
}
