// ============================================================
// IterUp — configurazione globale
// ------------------------------------------------------------
// CONGELATO dopo la Fase 0 (vedi CLAUDE.md regola 2).
// ============================================================

// Unico utente dell'app (niente login, vedi PRD sezione 3bis).
// Sostituisci con l'id restituito dall'insert in auth.users
// (vedi fondo di /schema.sql), poi impostalo anche come
// CURRENT_USER_ID in .env.local se preferisci non hardcodarlo.
export const CURRENT_USER_ID =
  process.env.CURRENT_USER_ID || "00000000-0000-0000-0000-000000000000";
