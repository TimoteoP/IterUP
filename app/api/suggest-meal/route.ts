// ============================================================
// IterUp — POST /api/suggest-meal (A3, Generatore Pasti AI)
// ------------------------------------------------------------
// Vedi PRD-addendum-openrouter.md sezioni 6-8 per modelli, schema
// JSON e system prompt: NON modificare quelle scelte da qui, sono
// decisioni di prodotto prese esplicitamente dall'utente.
//
// Body: { mealType: "colazione"|"pranzo"|"cena"|"spuntino" }
// Tutto il resto (regime, allergie, preferenze, target macro) viene
// letto server-side da profiles/user_targets per CURRENT_USER_ID,
// mai passato dal client (vedi CLAUDE.md regola 1).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { callOpenRouterJSON } from "@/lib/openrouter";
import { DIET_MODES, dietaryRegimeLabel, type MealType } from "@/lib/nutrition-options";

export const dynamic = "force-dynamic";

// Catena di fallback definitiva, vedi PRD-addendum-openrouter.md sezione 6.
// NON usare openrouter/auto, non aggiungere/rimuovere livelli senza
// che sia l'utente a deciderlo esplicitamente.
const MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "deepseek/deepseek-v4-flash-0731",
  "google/gemini-3.1-flash-lite",
];

// Quota indicativa del target giornaliero per tipo di pasto. Non
// specificata dall'addendum: scelta pragmatica del supervisore,
// applicata al target *giornaliero* (non ai residui) per dare un
// obiettivo stabile indipendente da quanto già consumato oggi.
const MEAL_SHARE: Record<Extract<MealType, "colazione" | "pranzo" | "cena" | "spuntino">, number> = {
  colazione: 0.25,
  pranzo: 0.35,
  cena: 0.3,
  spuntino: 0.1,
};

const FOOD_MEAL_TYPES = Object.keys(MEAL_SHARE) as (keyof typeof MEAL_SHARE)[];

interface RawIngredient {
  alimento: string;
  quantita_g: number;
}

interface RawProposal {
  nome: string;
  descrizione: string;
  ingredienti: RawIngredient[];
  macro: { kcal: number; proteine_g: number; carboidrati_g: number; grassi_g: number };
  tipo_pasto: string;
  note_regime?: string;
}

interface RawResponse {
  proposte: RawProposal[];
}

export interface ValidatedIngredient {
  alimento: string;
  food_id: string;
  quantita_g: number;
}

export interface ValidatedProposal {
  nome: string;
  descrizione: string;
  ingredienti: ValidatedIngredient[];
  macro: { kcal: number; proteine_g: number; carboidrati_g: number; grassi_g: number };
  tipo_pasto: string;
  note_regime?: string;
}

function buildSystemPrompt(params: {
  modeLabel: string;
  regimeLabel: string;
  targetKcal: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  mealTypeLabel: string;
  allergies: string[];
  preferences: string[];
  foodsList: string;
}): string {
  const {
    modeLabel,
    regimeLabel,
    targetKcal,
    targetProtein,
    targetCarbs,
    targetFat,
    mealTypeLabel,
    allergies,
    preferences,
    foodsList,
  } = params;

  return `Sei un assistente nutrizionale. Genera esattamente 5 proposte di pasto che rispettino rigorosamente i vincoli indicati, restituendo SOLO un oggetto JSON conforme allo schema fornito, senza testo aggiuntivo prima o dopo.

DATI UTENTE:
- Obiettivo dieta: ${modeLabel}
- Regime alimentare: ${regimeLabel}
- Target per questo pasto: ${targetKcal} kcal, ${targetProtein}g proteine, ${targetCarbs}g carboidrati, ${targetFat}g grassi
- Tipo pasto richiesto: ${mealTypeLabel}
- Allergie/intolleranze (VINCOLO ASSOLUTO, non violare mai): ${allergies.length ? allergies.join(", ") : "nessuna"}
- Preferenze alimentari (da massimizzare quando possibile, non vincolante): ${preferences.length ? preferences.join(", ") : "nessuna"}

ALIMENTI DISPONIBILI (usa SOLO questi, con questi nomi esatti):
${foodsList}

REGOLE:
1. Rispetta sempre le allergie elencate: non proporre mai un ingrediente presente in quella lista, nemmeno in tracce.
2. Rispetta i vincoli del regime alimentare selezionato (es. keto = carboidrati bassi).
3. Avvicinati il più possibile ai target macro indicati, con una tolleranza del 10%.
4. Tieni conto delle preferenze alimentari per aumentare la probabilità che il pasto piaccia, ma non è un vincolo assoluto come le allergie.
5. Varia gli ingredienti tra le 5 proposte: evita di riproporre la stessa combinazione con piccole variazioni.
6. Usa solo alimenti dalla lista fornita, con il nome esatto indicato.

Schema JSON atteso:
{"proposte":[{"nome":"string","descrizione":"string (max 2 frasi)","ingredienti":[{"alimento":"string (nome esatto dalla lista)","quantita_g":number}],"macro":{"kcal":number,"proteine_g":number,"carboidrati_g":number,"grassi_g":number},"tipo_pasto":"string","note_regime":"string (opzionale)"}]}

Rispondi SOLO con il JSON conforme allo schema, nessun altro testo.`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const { mealType } = (body ?? {}) as Record<string, unknown>;

  if (typeof mealType !== "string" || !FOOD_MEAL_TYPES.includes(mealType as typeof FOOD_MEAL_TYPES[number])) {
    return NextResponse.json(
      { error: `mealType deve essere uno tra: ${FOOD_MEAL_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  const meal = mealType as keyof typeof MEAL_SHARE;

  const [profileResult, targetResult, foodsResult] = await Promise.all([
    supabaseServer
      .from("profiles")
      .select("dietary_regime, allergies, preferences")
      .eq("id", CURRENT_USER_ID)
      .maybeSingle(),
    supabaseServer
      .from("user_targets")
      .select("mode, daily_kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", CURRENT_USER_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer.from("foods").select("id, name, kcal_100g, protein_100g, carbs_100g, fat_100g"),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }
  if (targetResult.error) {
    return NextResponse.json({ error: targetResult.error.message }, { status: 500 });
  }
  if (foodsResult.error) {
    return NextResponse.json({ error: foodsResult.error.message }, { status: 500 });
  }
  if (!targetResult.data) {
    return NextResponse.json(
      { error: "Nessun target attivo: completa prima l'onboarding." },
      { status: 400 }
    );
  }
  const foods = foodsResult.data ?? [];
  if (foods.length === 0) {
    return NextResponse.json({ error: "Nessun alimento disponibile nel DB." }, { status: 500 });
  }

  const target = targetResult.data;
  const share = MEAL_SHARE[meal];
  const targetKcal = Math.round(target.daily_kcal * share);
  const targetProtein = Math.round(target.protein_g * share);
  const targetCarbs = Math.round(target.carbs_g * share);
  const targetFat = Math.round(target.fat_g * share);

  const modeLabel = DIET_MODES.find((m) => m.value === target.mode)?.label ?? target.mode;
  const regimeLabel = dietaryRegimeLabel(profileResult.data?.dietary_regime ?? "mediterraneo");
  const mealTypeLabel = meal;
  const allergies = profileResult.data?.allergies ?? [];
  const preferences = profileResult.data?.preferences ?? [];

  const foodsByName = new Map(foods.map((f) => [f.name.trim().toLowerCase(), f]));
  const foodsList = foods.map((f) => `- ${f.name} (${f.kcal_100g} kcal/100g)`).join("\n");

  const systemPrompt = buildSystemPrompt({
    modeLabel,
    regimeLabel,
    targetKcal,
    targetProtein,
    targetCarbs,
    targetFat,
    mealTypeLabel,
    allergies,
    preferences,
    foodsList,
  });

  let raw: RawResponse;
  let modelUsed: string | null = null;
  try {
    const result = await callOpenRouterJSON<RawResponse>({
      models: MODELS,
      messages: [{ role: "system", content: systemPrompt }],
    });
    raw = result.data;
    modelUsed = result.log.modelUsed;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore nella generazione AI" },
      { status: 502 }
    );
  }

  if (!Array.isArray(raw.proposte)) {
    return NextResponse.json({ error: "Risposta AI malformata (proposte mancanti)" }, { status: 502 });
  }

  // Validazione + ricalcolo macro reali (mai fidarsi dei macro
  // auto-riportati dal modello, vedi addendum sezione 7): ogni
  // ingrediente deve corrispondere a un alimento reale in `foods`;
  // le proposte con anche un solo alimento non riconosciuto vengono
  // scartate interamente, non silenziosamente aggiustate.
  const validated: ValidatedProposal[] = [];
  for (const p of raw.proposte) {
    if (!Array.isArray(p.ingredienti) || p.ingredienti.length === 0) continue;

    const resolvedIngredients: ValidatedIngredient[] = [];
    let ok = true;
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const ing of p.ingredienti) {
      const food = foodsByName.get((ing.alimento ?? "").trim().toLowerCase());
      const qty = Number(ing.quantita_g);
      if (!food || !Number.isFinite(qty) || qty <= 0) {
        ok = false;
        break;
      }
      const factor = qty / 100;
      kcal += food.kcal_100g * factor;
      protein += food.protein_100g * factor;
      carbs += food.carbs_100g * factor;
      fat += food.fat_100g * factor;
      resolvedIngredients.push({ alimento: food.name, food_id: food.id, quantita_g: qty });
    }

    if (!ok) {
      console.warn("Proposta scartata: alimento non riconosciuto", p.nome);
      continue;
    }

    validated.push({
      nome: p.nome,
      descrizione: p.descrizione,
      ingredienti: resolvedIngredients,
      macro: {
        kcal: Math.round(kcal),
        proteine_g: Math.round(protein * 10) / 10,
        carboidrati_g: Math.round(carbs * 10) / 10,
        grassi_g: Math.round(fat * 10) / 10,
      },
      tipo_pasto: p.tipo_pasto,
      note_regime: p.note_regime,
    });
  }

  return NextResponse.json({
    mealType: meal,
    target: { kcal: targetKcal, protein_g: targetProtein, carbs_g: targetCarbs, fat_g: targetFat },
    modelUsed,
    proposte: validated,
  });
}
