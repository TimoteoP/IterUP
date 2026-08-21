// ============================================================
// IterUp — middleware di autenticazione
// ------------------------------------------------------------
// Protegge tutte le pagine e le API route dietro un cookie di
// sessione httpOnly (vedi lib/session.ts): senza sessione valida,
// redirect a /login (pagine) o 401 JSON (API). Sostituisce il vecchio
// meccanismo a token client-side, che finiva nel bundle pubblico
// (NEXT_PUBLIC_API_WRITE_TOKEN — la falla corretta con questa
// modifica).
//
// Eccezioni esplicite:
// - /login, /api/login: devono restare raggiungibili senza sessione,
//   altrimenti nessuno potrebbe più autenticarsi.
// - Le route chiamate da Shortcut iOS (mai un browser, non possono
//   avere un cookie di sessione): mantengono la propria
//   autenticazione dedicata a livello di singola route
//   (ACTIVITY_WEBHOOK_SECRET per /api/activity/ingest,
//   requireShortcutAuth/API_WRITE_SECRET per /api/coach/morning e
//   /api/coach/evening, nessun token per /api/reminders/status che
//   non espone dati personali) — vedi lib/api-auth.ts.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { SESSION_COOKIE_NAME, sessionOptions, type SessionData } from "@/lib/session-config";

const PUBLIC_PATHS = ["/login", "/api/login"];

const SHORTCUT_PATHS = [
  "/api/activity/ingest",
  "/api/coach/morning",
  "/api/coach/evening",
  "/api/reminders/status",
];

function isExempt(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || SHORTCUT_PATHS.includes(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isExempt(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let isLoggedIn = false;
  if (cookieValue) {
    try {
      const data = await unsealData<SessionData>(cookieValue, {
        password: sessionOptions.password,
        ttl: sessionOptions.ttl,
      });
      isLoggedIn = data.isLoggedIn === true;
    } catch {
      isLoggedIn = false;
    }
  }

  if (isLoggedIn) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tutto tranne asset statici Next.js e file pubblici della PWA
  // (manifest/icone/service worker devono restare raggiungibili senza
  // sessione, anche solo per mostrare la pagina di login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js).*)"],
};
