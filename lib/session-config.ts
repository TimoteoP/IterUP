// ============================================================
// IterUp — configurazione sessione condivisa (Edge-safe)
// ------------------------------------------------------------
// Nessun import di next/headers qui: questo file è importato anche
// da middleware.ts (Edge runtime), che non supporta next/headers
// cookies() — vedi lib/session.ts per l'uso in Route Handler.
// ============================================================

import type { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
}

export const SESSION_COOKIE_NAME = "iterup_session";

// 30 giorni: unico utente, dispositivo personale (telefono/desktop
// propri), niente motivo per forzare login frequenti.
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET mancante o troppo corta (minimo 32 caratteri) in .env.local");
  }
  return secret;
}

export const sessionOptions: SessionOptions = {
  cookieName: SESSION_COOKIE_NAME,
  password: getSessionSecret(),
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
  },
};
