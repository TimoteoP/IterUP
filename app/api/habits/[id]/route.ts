// ============================================================
// IterUp — API abitudine singola
// ------------------------------------------------------------
// PATCH  /api/habits/:id  -> aggiorna name/unit/target_value/is_active
// DELETE /api/habits/:id  -> elimina l'abitudine (cascade su habit_logs)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { Tables, TablesUpdate } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Corpo della richiesta non valido." }, { status: 400 });
  }

  const update: TablesUpdate<"habits"> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (body.type === "boolean" || body.type === "quantity") {
    update.type = body.type;
  }
  if (body.unit !== undefined) {
    update.unit = body.unit ? String(body.unit) : null;
  }
  if (body.target_value !== undefined) {
    update.target_value =
      body.target_value === null || body.target_value === ""
        ? null
        : Number(body.target_value);
  }
  if (typeof body.is_active === "boolean") {
    update.is_active = body.is_active;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nessun campo valido da aggiornare." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer.from("habits")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ habit: data as Tables<"habits"> });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { error } = await supabaseServer.from("habits")
    .delete()
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
