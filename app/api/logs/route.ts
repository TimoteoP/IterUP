// ============================================================
// IterUp — /api/logs
// ------------------------------------------------------------
// GET  ?date=YYYY-MM-DD   -> log del giorno (default: oggi). I macro
//                            sono uno snapshot salvato su daily_logs
//                            al momento del log (calcolato una sola
//                            volta da food.<campo>_100g * quantity_g
//                            / 100), non ricalcolati a ogni lettura.
// POST { meal_type, food_id?, quantity_g?, logged_at? } -> crea un log.
//        food_id/quantity_g sono richiesti solo per i pasti "con
//        alimento" (colazione/pranzo/cena/spuntino); 'digiuno' e
//        'integrazione' sono log diretti senza food_id, macro a 0.
//
// Tutte le query filtrano esplicitamente su CURRENT_USER_ID (niente
// auth.uid(), niente sessione — vedi CLAUDE.md regola 1).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { TablesInsert, Tables } from "@/lib/types";
import { isMealType, MEAL_TYPES_WITHOUT_FOOD, type MealType } from "@/lib/nutrition-options";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type LogWithMacros = Tables<"daily_logs"> & { food_name: string | null };

// `lib/types.ts` dichiara `Relationships: []` per ogni tabella (nessuna
// FK descritta), quindi il client non può inferire da solo la forma
// dell'embed `foods(...)`. Qui serve solo il nome per la UI: i macro
// arrivano già calcolati dalle colonne dirette di daily_logs.
type DailyLogRow = Tables<"daily_logs"> & {
  foods: { name: string } | null;
};

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayIso();

  const { data, error } = await supabaseServer
    .from("daily_logs")
    .select(
      `id, user_id, food_id, quantity_g, meal_type, kcal, protein_g, carbs_g, fat_g,
       fiber_g, logged_at, created_at, foods ( name )`
    )
    .eq("user_id", CURRENT_USER_ID)
    .eq("logged_at", date)
    .order("created_at", { ascending: true })
    .returns<DailyLogRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs: LogWithMacros[] = (data ?? []).map((row) => {
    const { foods, ...rest } = row;
    return { ...rest, food_name: foods?.name ?? null };
  });

  return NextResponse.json({ date, logs });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const { food_id, quantity_g, meal_type, logged_at } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (!isMealType(meal_type)) {
    return NextResponse.json({ error: "meal_type non valido" }, { status: 400 });
  }
  if (logged_at !== undefined && typeof logged_at !== "string") {
    return NextResponse.json({ error: "logged_at non valido" }, { status: 400 });
  }

  const needsFood = !MEAL_TYPES_WITHOUT_FOOD.includes(meal_type as MealType);

  let insertPayload: TablesInsert<"daily_logs">;

  if (needsFood) {
    if (typeof food_id !== "string" || food_id.length === 0) {
      return NextResponse.json({ error: "food_id mancante o non valido" }, { status: 400 });
    }
    if (typeof quantity_g !== "number" || !Number.isFinite(quantity_g) || quantity_g <= 0) {
      return NextResponse.json(
        { error: "quantity_g deve essere un numero maggiore di 0" },
        { status: 400 }
      );
    }

    const { data: food, error: foodError } = await supabaseServer
      .from("foods")
      .select("kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g")
      .eq("id", food_id)
      .maybeSingle();

    if (foodError) {
      return NextResponse.json({ error: foodError.message }, { status: 500 });
    }
    if (!food) {
      return NextResponse.json({ error: "Alimento non trovato" }, { status: 404 });
    }

    const factor = quantity_g / 100;
    insertPayload = {
      user_id: CURRENT_USER_ID,
      food_id,
      quantity_g,
      meal_type,
      kcal: Math.round(food.kcal_100g * factor * 10) / 10,
      protein_g: Math.round(food.protein_100g * factor * 10) / 10,
      carbs_g: Math.round(food.carbs_100g * factor * 10) / 10,
      fat_g: Math.round(food.fat_100g * factor * 10) / 10,
      fiber_g: food.fiber_100g !== null ? Math.round(food.fiber_100g * factor * 10) / 10 : null,
      ...(logged_at ? { logged_at } : {}),
    };
  } else {
    // digiuno / integrazione: nessun alimento, nessun macro (vedi
    // PRD-addendum-onboarding-form.md sezione 3).
    insertPayload = {
      user_id: CURRENT_USER_ID,
      food_id: null,
      quantity_g: null,
      meal_type,
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: null,
      ...(logged_at ? { logged_at } : {}),
    };
  }

  const { data, error } = await supabaseServer
    .from("daily_logs")
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data }, { status: 201 });
}
