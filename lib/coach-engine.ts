// ============================================================
// IterUp — Coach Comportamentale: orchestrazione (I/O)
// ------------------------------------------------------------
// Vedi PRD-addendum-coach-comportamentale.md sezioni 3.1 e 3.3. Fa da
// ponte tra lib/coach-triggers.ts (rilevamento puro) e
// lib/coach-messages.ts (generazione LLM): applica switch on/off,
// cap di frequenza per categoria, e il ciclo di feedback 👍/👎 (non
// ML — un semplice aggiustamento di soglia/frequenza basato sul tasso
// di gradimento aggregato per trigger_type).
// ============================================================

import { supabaseServer } from "./supabase/server";
import { CURRENT_USER_ID } from "./config";
import { generateNudgeMessage } from "./coach-messages";
import type { TriggerResult } from "./coach-triggers";
import type { Tables, TablesInsert, Json } from "./types";

// Cap di frequenza per categoria (sezione 3.1): ore minime tra due
// nudge dello stesso trigger_type. "peso" max ~1/settimana, "pasto
// sopra target" max 1/giorno, gli eventi rari per natura (streak,
// obiettivo, abitudine saltata) hanno comunque un cap di base contro
// spam accidentale a monte.
const BASE_COOLDOWN_HOURS: Record<string, number> = {
  weight_plateau: 24 * 7,
  hunger_pattern: 24 * 3,
  habit_missed: 24 * 7,
  goal_delayed: 24 * 7,
  meal_over_target: 24,
  streak_milestone: 1,
};

const REDUCE_FREQUENCY_BELOW_SATISFACTION = 0.5;
const DISABLE_BELOW_SATISFACTION = 0.2;
const MIN_REACTIONS_BEFORE_DISABLE = 3;

async function getPreference(triggerType: string): Promise<Tables<"coach_preferences"> | null> {
  const { data } = await supabaseServer
    .from("coach_preferences")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .eq("trigger_type", triggerType)
    .maybeSingle();
  return data ?? null;
}

function effectiveCooldownHours(triggerType: string, satisfactionScore: number | null): number {
  const base = BASE_COOLDOWN_HOURS[triggerType] ?? 24;
  if (satisfactionScore !== null && satisfactionScore < REDUCE_FREQUENCY_BELOW_SATISFACTION) {
    return base * 3;
  }
  return base;
}

/**
 * Dato un trigger già rilevato (da lib/coach-triggers.ts), decide se
 * generare davvero un nudge: rispetta lo switch on/off, il cap di
 * frequenza (eventualmente allungato se il gradimento è basso), poi
 * chiama l'LLM e persiste su coach_nudges. Ritorna null se il nudge
 * non va mostrato (silenziato o troppo presto dall'ultimo).
 */
export async function maybeCreateNudge(
  trigger: TriggerResult,
  goalTitle?: string | null
): Promise<Tables<"coach_nudges"> | null> {
  const pref = await getPreference(trigger.triggerType);
  if (pref?.enabled === false) return null;

  const cooldownHours = effectiveCooldownHours(trigger.triggerType, pref?.satisfaction_score ?? null);
  if (pref?.last_shown_at) {
    const hoursSince = (Date.now() - new Date(pref.last_shown_at).getTime()) / 3_600_000;
    if (hoursSince < cooldownHours) return null;
  }

  const { message, toneUsed } = await generateNudgeMessage({
    triggerType: trigger.triggerType,
    triggerData: trigger.data,
    preferredTone: pref?.preferred_tone ?? null,
    goalTitle,
  });

  const insert: TablesInsert<"coach_nudges"> = {
    user_id: CURRENT_USER_ID,
    trigger_type: trigger.triggerType,
    trigger_data: trigger.data as unknown as Json,
    message,
    tone_used: toneUsed,
  };

  const { data, error } = await supabaseServer.from("coach_nudges").insert(insert).select().single();
  if (error || !data) return null;

  await supabaseServer
    .from("coach_preferences")
    .upsert(
      { user_id: CURRENT_USER_ID, trigger_type: trigger.triggerType, last_shown_at: new Date().toISOString() },
      { onConflict: "user_id,trigger_type" }
    );

  return data;
}

/**
 * Registra una reazione (👍/👎/silenzia) e aggiorna il ciclo di
 * feedback (sezione 3.3): ricalcola il tasso di gradimento aggregato
 * per il trigger_type, riduce la frequenza sotto una soglia, disattiva
 * sotto una soglia più bassa (con un minimo di reazioni per evitare
 * di disattivare da un singolo 👎 isolato), salva il tono preferito
 * (quello con più 👍 tra le varianti usate finora).
 */
export async function recordNudgeFeedback(
  nudgeId: string,
  reaction: "like" | "dislike" | "dismissed"
): Promise<{ triggerType: string } | { error: string }> {
  const { data: nudge, error: updateError } = await supabaseServer
    .from("coach_nudges")
    .update({ reaction })
    .eq("id", nudgeId)
    .eq("user_id", CURRENT_USER_ID)
    .select("trigger_type")
    .single();

  if (updateError || !nudge) {
    return { error: updateError?.message ?? "Nudge non trovato" };
  }

  const { data: history } = await supabaseServer
    .from("coach_nudges")
    .select("reaction, tone_used")
    .eq("user_id", CURRENT_USER_ID)
    .eq("trigger_type", nudge.trigger_type)
    .not("reaction", "is", null);

  const rows = history ?? [];
  // "dismissed" (silenzia) non è un giudizio sul contenuto del
  // messaggio, solo "non ora": non entra nel tasso di gradimento.
  const judged = rows.filter((h) => h.reaction === "like" || h.reaction === "dislike");
  const likes = judged.filter((h) => h.reaction === "like").length;
  const satisfactionScore = judged.length > 0 ? likes / judged.length : null;

  const likedByTone = new Map<string, number>();
  for (const h of rows) {
    if (h.reaction === "like" && h.tone_used) {
      likedByTone.set(h.tone_used, (likedByTone.get(h.tone_used) ?? 0) + 1);
    }
  }
  let preferredTone: string | null = null;
  let bestCount = 0;
  for (const [tone, count] of Array.from(likedByTone)) {
    if (count > bestCount) {
      bestCount = count;
      preferredTone = tone;
    }
  }

  const shouldDisable =
    satisfactionScore !== null &&
    judged.length >= MIN_REACTIONS_BEFORE_DISABLE &&
    satisfactionScore < DISABLE_BELOW_SATISFACTION;

  await supabaseServer.from("coach_preferences").upsert(
    {
      user_id: CURRENT_USER_ID,
      trigger_type: nudge.trigger_type,
      satisfaction_score: satisfactionScore,
      ...(preferredTone ? { preferred_tone: preferredTone } : {}),
      ...(shouldDisable ? { enabled: false } : {}),
    },
    { onConflict: "user_id,trigger_type" }
  );

  return { triggerType: nudge.trigger_type };
}
