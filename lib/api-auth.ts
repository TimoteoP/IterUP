// ============================================================
// IterUp — guardie di autenticazione per le API route
// ------------------------------------------------------------
// Due meccanismi distinti per due tipi di chiamante:
//
// - requireApiAuth: per il client dell'app (browser). Verifica il
//   cookie di sessione httpOnly impostato al login (vedi
//   lib/session.ts, app/api/login/route.ts). middleware.ts fa già
//   questo controllo prima che la richiesta arrivi qui — questo è un
//   secondo livello di difesa in profondità sulla singola route, non
//   l'unico controllo. Asincrona: la verifica crittografica del
//   cookie (iron-session/Web Crypto) non può essere sincrona, a
//   differenza del vecchio controllo a token statico che sostituisce.
//
// - requireShortcutAuth: per chiamanti che NON sono mai un browser
//   (Shortcut iOS pianificati: /api/coach/morning, /api/coach/evening)
//   e quindi non possono avere un cookie di sessione. Resta il
//   vecchio meccanismo a token (header x-api-token o query ?token=)
//   contro un secret server-only — mai esposto al client, mai un
//   NEXT_PUBLIC_. Stesso pattern già in uso per /api/activity/ingest
//   (che però ha un secret dedicato, ACTIVITY_WEBHOOK_SECRET, gestito
//   per conto proprio in quella route).
// ============================================================

import { NextResponse } from "next/server";
import { getSession } from "./session";

export async function requireApiAuth(request: Request): Promise<NextResponse | null> {
  void request; // presente per uniformità di firma con requireShortcutAuth, non serve qui: la sessione viaggia nel cookie letto via next/headers
  const session = await getSession();
  if (session.isLoggedIn === true) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function requireShortcutAuth(request: Request): NextResponse | null {
  const secret = process.env.API_WRITE_SECRET;
  const headerToken = request.headers.get("x-api-token");
  const queryToken = new URL(request.url).searchParams.get("token");
  const providedToken = headerToken ?? queryToken;

  if (!secret || !providedToken || providedToken !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
