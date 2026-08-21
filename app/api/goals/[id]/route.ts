// ============================================================
// IterUp — API obiettivo singolo
// ------------------------------------------------------------
// PATCH  /api/goals/:id  -> aggiorna title/goal_type/target_value/
//                            target_date/status. Se status passa a
//                            'raggiunto' valorizza completed_at,
//                            altrimenti lo azzera.
// DELETE /api/goals/:id  -> elimina l'obiettivo
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { Tables, TablesUpdate } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const GOAL_TYPES = ["weight", "habit_streak", "activity", "custom"] as const;
const STATUSES = ["in_corso", "raggiunto", "abbandonato"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Corpo della richiesta non valido." }, { status: 400 });
  }

  const update: TablesUpdate<"goals"> = {};

  if (typeof body.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
  }
  if ((GOAL_TYPES as readonly string[]).includes(body.goal_type)) {
    update.goal_type = body.goal_type;
  }
  if (body.target_value !== undefined) {
    update.target_value =
      body.target_value === null || body.target_value === ""
        ? null
        : Number(body.target_value);
  }
  if (body.target_date !== undefined) {
    update.target_date = body.target_date ? String(body.target_date) : null;
  }
  if ((STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
    // Quando lo stato passa a 'raggiunto' valorizza completed_at con
    // la data/ora corrente; in ogni altro stato lo azzera.
    update.completed_at =
      body.status === "raggiunto" ? new Date().toISOString() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nessun campo valido da aggiornare." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer.from("goals")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data as Tables<"goals"> });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const { error } = await supabaseServer.from("goals")
    .delete()
    .eq("id", params.id)
    .eq("user_id", CURRENT_USER_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
