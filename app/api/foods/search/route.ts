// ============================================================
// IterUp — GET /api/foods/search?q=<termine>
// ------------------------------------------------------------
// Ricerca full-text (italiano) sulla tabella `foods.name`, che ha
// un indice gin(to_tsvector('italian', name)) — vedi schema.sql.
// Per query molto corte (1-2 caratteri) il full-text di Postgres
// spesso non produce lexeme utili (o va in errore su token vuoti
// tipo "e", "a"...), quindi usiamo un fallback ilike '%term%'.
//
// Nessuna scrittura qui: la tabella foods è pubblica in lettura
// (policy "foods_read_all"), non serve filtrare su CURRENT_USER_ID.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get("q") ?? "").trim();
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 50
      ? limitParam
      : DEFAULT_LIMIT;

  if (q.length === 0) {
    return NextResponse.json({ foods: [] });
  }

  // Query molto corte: il full-text (websearch_to_tsquery) su 1-2
  // caratteri spesso non trova nulla (parole troppo corte per i
  // lexeme italiani). Fallback su ilike, meno preciso ma affidabile.
  if (q.length < 3) {
    const { data, error } = await supabaseServer
      .from("foods")
      .select(
        "id, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g"
      )
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ foods: data ?? [] });
  }

  const { data, error } = await supabaseServer
    .from("foods")
    .select(
      "id, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g"
    )
    .textSearch("name", q, { type: "websearch", config: "italian" })
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se il full-text non trova nulla (es. termine parziale/prefisso,
  // tipico mentre l'utente sta ancora digitando), fallback a ilike
  // per non lasciare la ricerca "vuota" senza motivo apparente.
  if ((data ?? []).length === 0) {
    const { data: fallbackData, error: fallbackError } = await supabaseServer
      .from("foods")
      .select(
        "id, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g"
      )
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(limit);

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }
    return NextResponse.json({ foods: fallbackData ?? [] });
  }

  return NextResponse.json({ foods: data ?? [] });
}
