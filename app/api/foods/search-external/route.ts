// ============================================================
// IterUp — GET /api/foods/search-external?q=<termine>
// ------------------------------------------------------------
// Interroga Open Food Facts SOLO su richiesta esplicita dell'utente
// ("non trovato? cerca online"), mai come fallback automatico della
// ricerca interna — vedi PRD-addendum-hardening-completamento.md A5.
// Sola lettura: non scrive nulla in `foods`, restituisce solo
// candidati; l'import effettivo passa da POST /api/foods con
// source='off' (route separata, scelta esplicita dell'utente su
// quale candidato importare).
// ============================================================

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// L'endpoint REST v2 (/api/v2/search) è pensato per query strutturate
// (barcode, categorie, brand) e NON fa ricerca testuale libera
// affidabile: interrogato con "nutella" restituisce prodotti
// arbitrari non pertinenti (verificato). Il classico endpoint CGI
// resta quello corretto per il free-text search.
const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const DEFAULT_LIMIT = 10;

interface OFFNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_it?: string;
  brands?: string;
  nutriments?: OFFNutriments;
}

export interface ExternalFoodCandidate {
  source: "off";
  source_id: string;
  name: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  const url = new URL(OFF_SEARCH_URL);
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(DEFAULT_LIMIT));
  url.searchParams.set("fields", "code,product_name,product_name_it,brands,nutriments");

  let json: { products?: OFFProduct[] };
  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Open Food Facts chiede uno User-Agent identificativo per le
        // integrazioni di terze parti (non richiede API key).
        "User-Agent": "IterUp/1.0 (personal diet tracking app)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Open Food Facts non raggiungibile (HTTP ${res.status})` }, { status: 502 });
    }
    json = await res.json();
  } catch {
    return NextResponse.json({ error: "Errore di rete verso Open Food Facts" }, { status: 502 });
  }

  const candidates: ExternalFoodCandidate[] = (json.products ?? [])
    .map((p): ExternalFoodCandidate | null => {
      const n = p.nutriments;
      if (!p.code || !n) return null;
      const kcal = n["energy-kcal_100g"];
      const protein = n.proteins_100g;
      const carbs = n.carbohydrates_100g;
      const fat = n.fat_100g;
      // Prodotti senza valori nutrizionali completi non sono
      // utilizzabili come alimento nel diario: scartati, non mostrati
      // come candidati incompleti da importare.
      if (![kcal, protein, carbs, fat].every(isFiniteNumber)) return null;

      const name = (p.product_name_it?.trim() || p.product_name?.trim() || "").trim();
      if (!name) return null;

      const brand = p.brands?.split(",")[0].trim();
      const showBrand = brand && brand.toLowerCase() !== name.toLowerCase();

      return {
        source: "off",
        source_id: p.code,
        name: showBrand ? `${name} (${brand})` : name,
        kcal_100g: kcal as number,
        protein_100g: protein as number,
        carbs_100g: carbs as number,
        fat_100g: fat as number,
        fiber_100g: isFiniteNumber(n.fiber_100g) ? n.fiber_100g : null,
      };
    })
    .filter((c): c is ExternalFoodCandidate => c !== null);

  return NextResponse.json({ foods: candidates });
}
