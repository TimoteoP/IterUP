// ============================================================
// IterUp — Negative Self-Talk: valutazione pattern (I/O)
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 4, step 5: "Job
// schedulato (settimanale)... non in tempo reale sulla singola
// entry". Senza infrastruttura di cron (vedi lib/coach-evaluators.ts
// per lo stesso compromesso pragmatico già adottato nel modulo
// Coach), la valutazione è lazy con un cooldown: rieseguita solo se
// l'ultima valutazione risale a più di 24h fa, quando l'utente apre
// la pagina Pattern — mai ad ogni singola entry salvata.
// ============================================================

import { supabaseServer } from "./supabase/server";
import { CURRENT_USER_ID } from "./config";
import { detectAllPatterns } from "./self-talk-patterns";
import type { Tables } from "./types";
import type { ThemeTag } from "./self-talk-taxonomy";

const RECOMPUTE_COOLDOWN_HOURS = 24;
// Finestra di dati sufficiente per il pattern con la finestra più
// ampia (theme_concentration, 30 giorni) più un margine.
const LOOKBACK_DAYS = 35;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Rivaluta i pattern (se non già fatto nelle ultime 24h) e ritorna
 * tutti i pattern_flags dell'utente, più recenti prima.
 */
export async function getOrRecomputePatternFlags(): Promise<Tables<"pattern_flags">[]> {
  const { data: lastFlag } = await supabaseServer
    .from("pattern_flags")
    .select("created_at")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hoursSinceLast = lastFlag?.created_at
    ? (Date.now() - new Date(lastFlag.created_at).getTime()) / 3_600_000
    : Infinity;

  if (hoursSinceLast >= RECOMPUTE_COOLDOWN_HOURS) {
    await recomputePatternFlags();
  }

  const { data } = await supabaseServer
    .from("pattern_flags")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: false })
    .limit(20);

  return data ?? [];
}

async function recomputePatternFlags(): Promise<void> {
  const today = todayIso();
  const cutoff = addDaysIso(today, -LOOKBACK_DAYS);

  const { data } = await supabaseServer
    .from("self_talk_entries")
    .select("created_at, theme, mood_before")
    .eq("user_id", CURRENT_USER_ID)
    .gte("created_at", cutoff);

  const entries = (data ?? []).map((e) => ({
    createdAt: e.created_at,
    theme: e.theme as ThemeTag | null,
    moodBefore: e.mood_before,
  }));

  const results = detectAllPatterns(entries, today);

  for (const result of results) {
    // Evita di rigenerare lo stesso flag_type se ne esiste già uno
    // creato dentro la stessa finestra rilevata (niente spam
    // giornaliero dello stesso pattern persistente).
    const { data: existing } = await supabaseServer
      .from("pattern_flags")
      .select("id")
      .eq("user_id", CURRENT_USER_ID)
      .eq("flag_type", result.flagType)
      .gte("created_at", result.windowStart)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    await supabaseServer.from("pattern_flags").insert({
      user_id: CURRENT_USER_ID,
      flag_type: result.flagType,
      window_start: result.windowStart,
      window_end: result.windowEnd,
      summary_text: result.summaryText,
    });
  }
}
