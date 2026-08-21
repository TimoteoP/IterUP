// ============================================================
// IterUp — POST /api/login
// ------------------------------------------------------------
// Unica route pubblica insieme a /login stessa (vedi middleware.ts).
// Confronta la password inviata con APP_PASSWORD (env, mai nel
// bundle client) con un confronto a tempo costante — il rischio di
// timing attack è basso per un'app personale, ma è comunque la scelta
// corretta quando si confrontano segreti, non costa nulla farlo bene.
// Se corretta, imposta il cookie di sessione httpOnly (30 giorni).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Confronto contro se stesso per non far variare i tempi in base
    // alla lunghezza della password inviata (altrimenti la differenza
    // di lunghezza da sola sarebbe rilevabile via timing).
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return NextResponse.json({ error: "APP_PASSWORD non configurata sul server." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !constantTimeEqual(password, appPassword)) {
    return NextResponse.json({ error: "Password errata." }, { status: 401 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
