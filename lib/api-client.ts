// ============================================================
// IterUp — fetch con token per le API route di scrittura
// ------------------------------------------------------------
// Allega automaticamente l'header x-api-token (verificato da
// lib/api-auth.ts) a ogni chiamata di scrittura. Usare al posto di
// fetch() nudo per POST/PATCH/DELETE verso /api/**; le GET restano
// fetch() normale, non richiedono il token.
// ============================================================

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.NEXT_PUBLIC_API_WRITE_TOKEN;
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { "x-api-token": token } : {}),
    },
  });
}
