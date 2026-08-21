// ============================================================
// IterUp — /api/self-talk/entries
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 4 (step 1 e 2).
// GET  ?limit=N -> ultime entry con i tag associati (source user+llm).
// POST { rawText, moodBefore?, theme? } -> quick capture: salva
//        subito, poi tenta la classificazione automatica LLM (theme
//        se non fornito + 0-2 distorsioni più probabili come
//        distortion_tags source='llm'), best-effort — un fallimento
//        della classificazione non deve mai far perdere l'entry.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";
import { requireApiAuth } from "@/lib/api-auth";
import { isThemeTag } from "@/lib/self-talk-taxonomy";
import { classifyEntry } from "@/lib/self-talk-messages";
import type { TablesInsert, Tables } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const RAW_TEXT_MAX_LENGTH = 4000;

export async function GET(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number(limitParam) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;

  const { data: entries, error } = await supabaseServer
    .from("self_talk_entries")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: tags } = entryIds.length
    ? await supabaseServer.from("distortion_tags").select("*").in("entry_id", entryIds)
    : { data: [] as Tables<"distortion_tags">[] };

  const tagsByEntry = new Map<string, Tables<"distortion_tags">[]>();
  for (const tag of tags ?? []) {
    if (!tagsByEntry.has(tag.entry_id)) tagsByEntry.set(tag.entry_id, []);
    tagsByEntry.get(tag.entry_id)!.push(tag);
  }

  const entriesWithTags = (entries ?? []).map((e) => ({ ...e, tags: tagsByEntry.get(e.id) ?? [] }));

  return NextResponse.json({ entries: entriesWithTags });
}

export async function POST(request: NextRequest) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
  if (!rawText) {
    return NextResponse.json({ error: "Il campo 'rawText' è obbligatorio." }, { status: 400 });
  }
  if (rawText.length > RAW_TEXT_MAX_LENGTH) {
    return NextResponse.json({ error: `Testo troppo lungo (max ${RAW_TEXT_MAX_LENGTH} caratteri).` }, { status: 400 });
  }

  const moodBefore = body?.moodBefore;
  if (moodBefore !== undefined && moodBefore !== null) {
    if (typeof moodBefore !== "number" || moodBefore < 1 || moodBefore > 10) {
      return NextResponse.json({ error: "moodBefore deve essere un numero tra 1 e 10." }, { status: 400 });
    }
  }

  const providedTheme = body?.theme;
  if (providedTheme !== undefined && providedTheme !== null && !isThemeTag(providedTheme)) {
    return NextResponse.json({ error: "theme non valido." }, { status: 400 });
  }

  const insertPayload: TablesInsert<"self_talk_entries"> = {
    user_id: CURRENT_USER_ID,
    raw_text: rawText,
    mood_before: moodBefore ?? null,
    theme: providedTheme ?? null,
  };

  const { data: entry, error } = await supabaseServer
    .from("self_talk_entries")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: error?.message ?? "Errore nel salvataggio" }, { status: 500 });
  }

  // Classificazione automatica best-effort: mai far fallire la
  // cattura rapida se l'LLM non risponde o restituisce un errore.
  let tags: Tables<"distortion_tags">[] = [];
  try {
    const classification = await classifyEntry(rawText);

    if (!providedTheme && classification.theme) {
      await supabaseServer.from("self_talk_entries").update({ theme: classification.theme }).eq("id", entry.id);
      entry.theme = classification.theme;
    }

    if (classification.distortions.length > 0) {
      const tagInserts: TablesInsert<"distortion_tags">[] = classification.distortions.map((d) => ({
        entry_id: entry.id,
        user_id: CURRENT_USER_ID,
        distortion_type: d,
        source: "llm",
      }));
      const { data: insertedTags } = await supabaseServer.from("distortion_tags").insert(tagInserts).select("*");
      tags = insertedTags ?? [];
    }
  } catch {
    // Classificazione fallita: l'entry resta comunque salvata.
  }

  return NextResponse.json({ entry: { ...entry, tags } }, { status: 201 });
}
