// ============================================================
// IterUp — GET /api/self-talk/dashboard
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 7. Sola lettura,
// aggrega:
// - distribuzione distorsioni (ultimi 90 giorni)
// - trend mood_before -> mood_after (misura se il reframe funziona)
// - distribuzione per theme (ultimi 30 giorni)
// - divergenza tag source 'user' vs 'llm' per bucket mensile
// - pattern_flags correnti (stessa fonte di GET /api/self-talk/patterns)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import { getOrRecomputePatternFlags } from "@/lib/self-talk-engine";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const today = todayIso();
  const cutoff90 = addDaysIso(today, -90);
  const cutoff30 = addDaysIso(today, -30);
  const cutoff180 = addDaysIso(today, -180);

  const [entries90Result, entries30Result, entries180Result, flags] = await Promise.all([
    supabaseServer
      .from("self_talk_entries")
      .select("id, created_at")
      .eq("user_id", CURRENT_USER_ID)
      .gte("created_at", cutoff90),
    supabaseServer
      .from("self_talk_entries")
      .select("theme")
      .eq("user_id", CURRENT_USER_ID)
      .gte("created_at", cutoff30)
      .not("theme", "is", null),
    supabaseServer
      .from("self_talk_entries")
      .select("id, created_at")
      .eq("user_id", CURRENT_USER_ID)
      .gte("created_at", cutoff180),
    getOrRecomputePatternFlags(),
  ]);

  const entries90Ids = (entries90Result.data ?? []).map((e) => e.id);
  const entries180Ids = (entries180Result.data ?? []).map((e) => e.id);

  const { data: tags90 } = entries90Ids.length
    ? await supabaseServer.from("distortion_tags").select("entry_id, distortion_type, source").in("entry_id", entries90Ids)
    : { data: [] };

  const { data: tags180 } = entries180Ids.length
    ? await supabaseServer.from("distortion_tags").select("entry_id, source, distortion_type, created_at").in("entry_id", entries180Ids)
    : { data: [] };

  const { data: reframeSessions } = await supabaseServer
    .from("reframe_sessions")
    .select("entry_id, mood_after, completed_at")
    .eq("user_id", CURRENT_USER_ID)
    .not("mood_after", "is", null)
    .gte("completed_at", cutoff90);

  // mood_before non è nella select di entries90Result (solo id/
  // created_at): recuperato qui filtrato sugli entry_id delle
  // sessioni con mood_after, per non caricare più dati del necessario.
  const sessionEntryIds = (reframeSessions ?? []).map((r) => r.entry_id);
  const { data: entriesForMood } = sessionEntryIds.length
    ? await supabaseServer.from("self_talk_entries").select("id, mood_before").in("id", sessionEntryIds)
    : { data: [] };
  const moodBeforeById = new Map((entriesForMood ?? []).map((e) => [e.id, e.mood_before] as const));

  // Distribuzione distorsioni (entrambe le fonti, ultimi 90 giorni).
  const distortionDistribution = new Map<string, number>();
  for (const tag of tags90 ?? []) {
    distortionDistribution.set(tag.distortion_type, (distortionDistribution.get(tag.distortion_type) ?? 0) + 1);
  }

  // Distribuzione per theme (ultimi 30 giorni).
  const themeDistribution = new Map<string, number>();
  for (const e of entries30Result.data ?? []) {
    if (!e.theme) continue;
    themeDistribution.set(e.theme, (themeDistribution.get(e.theme) ?? 0) + 1);
  }

  // Trend mood_before -> mood_after: solo sessioni con entrambi i valori.
  const moodTrend = (reframeSessions ?? [])
    .map((r) => ({
      date: (r.completed_at ?? "").slice(0, 10),
      moodBefore: moodBeforeById.get(r.entry_id) ?? null,
      moodAfter: r.mood_after,
    }))
    .filter((r) => r.moodBefore !== null && r.moodAfter !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Divergenza user vs llm per bucket mensile (ultimi 6 mesi):
  // quota di entry (con tag di entrambe le fonti) in cui almeno un
  // tag utente coincide con almeno un tag llm.
  const tagsByEntry = new Map<string, { user: Set<string>; llm: Set<string>; month: string }>();
  for (const tag of tags180 ?? []) {
    if (!tagsByEntry.has(tag.entry_id)) {
      tagsByEntry.set(tag.entry_id, { user: new Set(), llm: new Set(), month: (tag.created_at ?? "").slice(0, 7) });
    }
    const bucket = tagsByEntry.get(tag.entry_id)!;
    bucket[tag.source as "user" | "llm"].add(tag.distortion_type);
  }

  const divergenceByMonth = new Map<string, { withBoth: number; agreeing: number }>();
  for (const { user, llm, month } of Array.from(tagsByEntry.values())) {
    if (user.size === 0 || llm.size === 0) continue;
    if (!divergenceByMonth.has(month)) divergenceByMonth.set(month, { withBoth: 0, agreeing: 0 });
    const bucket = divergenceByMonth.get(month)!;
    bucket.withBoth++;
    const agrees = Array.from(user).some((t) => llm.has(t));
    if (agrees) bucket.agreeing++;
  }

  const divergenceTrend = Array.from(divergenceByMonth.entries())
    .map(([month, { withBoth, agreeing }]) => ({
      month,
      entriesWithBothSources: withBoth,
      agreementPct: Math.round((agreeing / withBoth) * 100),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    distortionDistribution: Object.fromEntries(distortionDistribution),
    themeDistribution: Object.fromEntries(themeDistribution),
    moodTrend,
    divergenceTrend,
    patternFlags: flags,
  });
}
