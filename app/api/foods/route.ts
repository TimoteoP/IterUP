// ============================================================
// IterUp — POST /api/foods
// ------------------------------------------------------------
// Crea un nuovo alimento nel DB condiviso `foods` (source = 'manual',
// per distinguerlo dalle ~180 voci curate da USDA). Nessuna scrittura
// filtrata su CURRENT_USER_ID: `foods` non è per-utente, è il
// catalogo condiviso da cui pescano diario e generatore pasti AI.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/types";

export const dynamic = "force-dynamic";

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Il nome è obbligatorio." }, { status: 400 });
  }

  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;

  for (const field of ["kcal_100g", "protein_100g", "carbs_100g", "fat_100g"] as const) {
    if (!isFiniteNonNegative(body[field])) {
      return NextResponse.json({ error: `${field} deve essere un numero >= 0.` }, { status: 400 });
    }
  }
  if (body.fiber_100g !== undefined && body.fiber_100g !== null && !isFiniteNonNegative(body.fiber_100g)) {
    return NextResponse.json({ error: "fiber_100g deve essere un numero >= 0." }, { status: 400 });
  }

  const payload: TablesInsert<"foods"> = {
    name,
    category,
    kcal_100g: body.kcal_100g,
    protein_100g: body.protein_100g,
    carbs_100g: body.carbs_100g,
    fat_100g: body.fat_100g,
    fiber_100g: body.fiber_100g ?? null,
    source: "manual",
  };

  const { data, error } = await supabaseServer.from("foods").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ food: data }, { status: 201 });
}
