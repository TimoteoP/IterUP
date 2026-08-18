// ============================================================
// IterUp — guardia di autenticazione per le API route
// ------------------------------------------------------------
// Le API route non hanno mai avuto un controllo su chi le chiama
// (nessun login, vedi CLAUDE.md regola 1): chiunque conoscesse l'URL
// dell'app deployata poteva leggere/scrivere/cancellare dati via
// HTTP, dato che ogni route usa la service role key server-side a
// prescindere dal chiamante. Stesso pattern già in uso per il webhook
// /api/activity/ingest (ACTIVITY_WEBHOOK_SECRET), esteso qui a tutte
// le altre route (lettura e scrittura) con un secret condiviso
// separato: il client (l'app stessa) lo allega via lib/api-client.ts,
// un chiamante esterno senza il token corretto viene respinto con 401.
//
// Eccezione deliberata: /api/reminders/status resta senza token,
// perché è pensato per essere interrogato da uno Shortcut iOS
// pianificato (non dal browser) e non espone dati personali (solo
// booleani "manca X oggi?") — vedi commento nel file stesso.
//
// Nota: il token è imbustato nel bundle client (NEXT_PUBLIC_...), non
// è quindi un segreto crittografico forte — è visibile a chi ispeziona
// la scheda Network. Alza comunque l'asticella da "chiunque conosca
// l'URL" a "chiunque ispezioni il traffico", nello stesso spirito del
// webhook già esistente. Protezione reale aggiuntiva: Vercel
// Deployment Protection una volta fatto il deploy.
// ============================================================

import { NextResponse } from "next/server";

export function requireApiAuth(request: Request): NextResponse | null {
  const secret = process.env.API_WRITE_SECRET;
  const headerToken = request.headers.get("x-api-token");
  const queryToken = new URL(request.url).searchParams.get("token");
  const providedToken = headerToken ?? queryToken;

  if (!secret || !providedToken || providedToken !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
