// ============================================================
// IterUp — PATCH/DELETE /api/supplements/[id]
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { TablesUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const update: TablesUpdate<"supplements"> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if ("dosage" in body) update.dosage = typeof body.dosage === "string" ? body.dosage.trim() || null : null;
  if ("unit" in body) update.unit = typeof body.unit === "string" ? body.unit.trim() || null : null;
  if ("note" in body) update.note = typeof body.note === "string" ? body.note.trim() || null : null;

  const { data, error } = await supabaseServer
    .from("supplements")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Integratore non trovato" }, { status: 404 });
  }

  return NextResponse.json({ supplement: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error, count } = await supabaseServer
    .from("supplements")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Integratore non trovato" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
