// ============================================================
// IterUp — /api/logs
// ------------------------------------------------------------
// GET  ?date=YYYY-MM-DD   -> log del giorno (default: oggi), con
//                            macro calcolati al volo via join con
//                            `foods` (daily_logs NON salva snapshot
//                            di kcal/protein/carbs/fat, vedi nota
//                            del supervisore — solo food_id + quantity_g).
// POST { food_id, quantity_g, meal_type, logged_at? } -> crea un log.
//
// Tutte le query filtrano esplicitamente su CURRENT_USER_ID (niente
// auth.uid(), niente sessione — vedi CLAUDE.md regola 1).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import type { TablesInsert } from "@/lib/types";

export const dynamic = "force-dynamic";

const MEAL_TYPES = ["colazione", "pranzo", "cena", "spuntino"] as const;
type MealType = (typeof MEAL_TYPES)[number];

function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type LogWithMacros = {
  id: string;
  food_id: string;
  food_name: string;
  quantity_g: number;
  meal_type: MealType;
  logged_at: string;
  created_at: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// `lib/types.ts` dichiara `Relationships: []` per ogni tabella (nessuna
// FK descritta), quindi il client non può inferire da solo la forma
// dell'embed `foods(...)`. Dichiariamo qui la forma reale della riga
// restituita da Postgres e la applichiamo con `.returns<...>()`.
type DailyLogRow = {
  id: string;
  food_id: string;
  quantity_g: number;
  meal_type: MealType;
  logged_at: string;
  created_at: string | null;
  foods: {
    name: string;
    kcal_100g: number;
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
  } | null;
};

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayIso();

  const { data, error } = await supabaseServer
    .from("daily_logs")
    .select(
      `id, food_id, quantity_g, meal_type, logged_at, created_at,
       foods ( name, kcal_100g, protein_100g, carbs_100g, fat_100g )`
    )
    .eq("user_id", CURRENT_USER_ID)
    .eq("logged_at", date)
    .order("created_at", { ascending: true })
    .returns<DailyLogRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs: LogWithMacros[] = (data ?? []).map((row) => {
    // La relazione foods può arrivare come oggetto o come array a
    // seconda della versione del client: normalizziamo entrambi i casi.
    const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
    const factor = row.quantity_g / 100;

    return {
      id: row.id,
      food_id: row.food_id,
      food_name: food?.name ?? "Alimento sconosciuto",
      quantity_g: row.quantity_g,
      meal_type: row.meal_type as MealType,
      logged_at: row.logged_at,
      created_at: row.created_at,
      kcal: (food?.kcal_100g ?? 0) * factor,
      protein_g: (food?.protein_100g ?? 0) * factor,
      carbs_g: (food?.carbs_100g ?? 0) * factor,
      fat_g: (food?.fat_100g ?? 0) * factor,
    };
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

  if (typeof food_id !== "string" || food_id.length === 0) {
    return NextResponse.json({ error: "food_id mancante o non valido" }, { status: 400 });
  }
  if (typeof quantity_g !== "number" || !Number.isFinite(quantity_g) || quantity_g <= 0) {
    return NextResponse.json(
      { error: "quantity_g deve essere un numero maggiore di 0" },
      { status: 400 }
    );
  }
  if (!isMealType(meal_type)) {
    return NextResponse.json(
      { error: `meal_type deve essere uno tra: ${MEAL_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (logged_at !== undefined && typeof logged_at !== "string") {
    return NextResponse.json({ error: "logged_at non valido" }, { status: 400 });
  }

  const insertPayload: TablesInsert<"daily_logs"> = {
    user_id: CURRENT_USER_ID,
    food_id,
    quantity_g,
    meal_type,
    ...(logged_at ? { logged_at } : {}),
  };

  const { data, error } = await supabaseServer
    .from("daily_logs")
    .insert([insertPayload])
    .select("id, food_id, quantity_g, meal_type, logged_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data }, { status: 201 });
}
