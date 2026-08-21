// ============================================================
// IterUp — GET /api/foods/search?q=<termine>
// ------------------------------------------------------------
// Tre livelli di ricerca, in ordine (ognuno tentato solo se il
// precedente non trova nulla):
// 1. Full-text italiano su foods.name (indice
//    gin(to_tsvector('italian', name))).
// 2. ilike '%term%' — fallback per query molto corte (1-2 caratteri,
//    dove il full-text spesso non produce lexeme utili) o quando il
//    full-text non trova nulla (termine parziale/prefisso).
// 3. Similarity trigram (pg_trgm, RPC search_foods_trgm — vedi
//    schema-migration-006-trgm.sql) — tollerante a errori di
//    battitura (es. "pomodooro"), dove ilike '%pomodooro%' non
//    troverebbe "Pomodori". Vedi PRD-addendum-hardening-completamento.md A5.
//
// Nessuna scrittura qui: la tabella foods è pubblica in lettura
// (policy "foods_read_all"), non serve filtrare su CURRENT_USER_ID.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const FOOD_COLUMNS = "id, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g";

async function searchIlike(q: string, limit: number) {
  return supabaseServer.from("foods").select(FOOD_COLUMNS).ilike("name", `%${q}%`).order("name", { ascending: true }).limit(limit);
}

async function searchTrigram(q: string, limit: number) {
  // RPC dedicata: PostgREST non permette di ordinare per una funzione
  // arbitraria (similarity()) direttamente dal query builder.
  return supabaseServer.rpc("search_foods_trgm", { search_term: q, match_limit: limit });
}

export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

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
  // lexeme italiani). Si parte direttamente da ilike.
  if (q.length < 3) {
    const { data, error } = await searchIlike(q, limit);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if ((data ?? []).length > 0) {
      return NextResponse.json({ foods: data });
    }

    const { data: trgmData, error: trgmError } = await searchTrigram(q, limit);
    if (trgmError) {
      return NextResponse.json({ error: trgmError.message }, { status: 500 });
    }
    return NextResponse.json({ foods: trgmData ?? [] });
  }

  const { data, error } = await supabaseServer
    .from("foods")
    .select(FOOD_COLUMNS)
    .textSearch("name", q, { type: "websearch", config: "italian" })
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if ((data ?? []).length > 0) {
    return NextResponse.json({ foods: data });
  }

  // Full-text vuoto (es. termine parziale/prefisso): fallback a ilike.
  const { data: ilikeData, error: ilikeError } = await searchIlike(q, limit);
  if (ilikeError) {
    return NextResponse.json({ error: ilikeError.message }, { status: 500 });
  }
  if ((ilikeData ?? []).length > 0) {
    return NextResponse.json({ foods: ilikeData });
  }

  // Ancora vuoto: probabile errore di battitura, ultimo tentativo
  // tollerante via similarity trigram.
  const { data: trgmData, error: trgmError } = await searchTrigram(q, limit);
  if (trgmError) {
    return NextResponse.json({ error: trgmError.message }, { status: 500 });
  }
  return NextResponse.json({ foods: trgmData ?? [] });
}
