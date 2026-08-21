// ============================================================
// IterUp — sessione di login, uso in Route Handler / Server Component
// ------------------------------------------------------------
// Sostituisce il vecchio meccanismo a token in NEXT_PUBLIC_ (leggibile
// nel bundle client, quindi copiabile da chiunque ispezionasse il
// sito deployato — falla di sicurezza corretta con questo modulo).
// App a singolo utente, un'unica password condivisa (APP_PASSWORD),
// nessun account/ruolo: il cookie contiene solo un booleano
// `isLoggedIn`, mai dati personali.
//
// Per middleware.ts (Edge runtime, non supporta next/headers) vedi
// lib/session-config.ts + unsealData usato direttamente lì.
// ============================================================

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "./session-config";

export { SESSION_COOKIE_NAME, sessionOptions, type SessionData } from "./session-config";

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
