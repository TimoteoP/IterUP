// ============================================================
// IterUp — GET /api/self-talk/patterns
// ------------------------------------------------------------
// Rivaluta (se non fatto nelle ultime 24h, vedi
// lib/self-talk-engine.ts) e ritorna i pattern_flags dell'utente.
// Nessun flag di tipo crisi: solo frequency_high/intensity_high/
// theme_concentration, usati per indicazioni e consigli (scelta
// esplicita dell'utente, vedi schema-migration-010).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getOrRecomputePatternFlags } from "@/lib/self-talk-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const flags = await getOrRecomputePatternFlags();

  return NextResponse.json({ flags });
}
