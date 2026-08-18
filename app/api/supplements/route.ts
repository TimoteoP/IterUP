// ============================================================
// IterUp — /api/supplements
// ------------------------------------------------------------
// CRUD sugli integratori posseduti dall'utente (vedi
// PRD-addendum-onboarding-form.md sezione 5.1). Fonte da cui pescherà
// il futuro generatore AI di combinazioni/dosaggi (sezione 4) e la
// chat Q&A (sezione 5.2) — non ancora implementati, in attesa del
// file di dettaglio OpenRouter.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { TablesInsert } from "@/lib/types";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseServer
    .from("supplements")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplements: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Il campo 'name' è obbligatorio." }, { status: 400 });
  }

  const payload: TablesInsert<"supplements"> = {
    user_id: CURRENT_USER_ID,
    name: body.name.trim(),
    dosage: typeof body.dosage === "string" && body.dosage.trim() ? body.dosage.trim() : null,
    unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : null,
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
  };

  const { data, error } = await supabaseServer
    .from("supplements")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplement: data }, { status: 201 });
}
