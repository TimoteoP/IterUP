// ============================================================
// IterUp — API abitudini (CRUD)
// ------------------------------------------------------------
// GET    /api/habits            -> lista abitudini dell'utente
//         ?active=true|false    -> filtra su is_active
// POST   /api/habits            -> crea una nuova abitudine
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { Tables, TablesInsert } from "@/lib/types";
import { habitsTable } from "./_db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const activeParam = request.nextUrl.searchParams.get("active");

  let query = habitsTable()
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: true });

  if (activeParam === "true") {
    query = query.eq("is_active", true);
  } else if (activeParam === "false") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ habits: data as Tables<"habits">[] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Il campo 'name' è obbligatorio." },
      { status: 400 }
    );
  }

  if (body.type !== "boolean" && body.type !== "quantity") {
    return NextResponse.json(
      { error: "Il campo 'type' deve essere 'boolean' o 'quantity'." },
      { status: 400 }
    );
  }

  const payload: TablesInsert<"habits"> = {
    user_id: CURRENT_USER_ID,
    name: body.name.trim(),
    type: body.type,
    unit: body.type === "quantity" && body.unit ? String(body.unit) : null,
    target_value:
      body.target_value !== undefined &&
      body.target_value !== null &&
      body.target_value !== ""
        ? Number(body.target_value)
        : null,
    is_active: body.is_active ?? true,
  };

  const { data, error } = await habitsTable()
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ habit: data as Tables<"habits"> }, { status: 201 });
}
