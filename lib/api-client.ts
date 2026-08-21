// ============================================================
// IterUp — fetch per le API route
// ------------------------------------------------------------
// Prima allegava manualmente un header x-api-token letto da
// NEXT_PUBLIC_API_WRITE_TOKEN — variabile pubblica, quindi finiva nel
// bundle JS servito al browser: chiunque ispezionasse il sito
// deployato poteva copiare il token e chiamare le API di scrittura
// direttamente, bypassando l'app (falla corretta con l'introduzione
// del login, vedi middleware.ts e lib/session.ts).
//
// L'autenticazione ora passa da un cookie di sessione httpOnly, che
// il browser allega da solo ad ogni richiesta same-origin: non serve
// più fare nulla qui. La funzione resta solo per non dover toccare
// ogni componente che la usa già al posto di fetch() nudo.
// ============================================================

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, init);
}
