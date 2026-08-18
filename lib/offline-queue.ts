// ============================================================
// IterUp — coda di scrittura offline per il diario alimentare
// ------------------------------------------------------------
// Vedi PRD-addendum-hardening-completamento.md A4. Nessuna libreria
// nuova: IndexedDB nativo del browser. Accoda i payload di
// POST /api/logs falliti per assenza di rete, li reinvia al ritorno
// online.
//
// Nota tecnica (dall'addendum): la Background Sync API ha supporto
// limitato/assente su iOS Safari, quindi il meccanismo primario di
// reinvio è un retry lato client all'evento `online`/al focus della
// pagina (vedi app/diario/page.tsx), non il solo service worker.
//
// Deduplica: ogni item ha un id client-generato (usato come keyPath),
// rimosso dalla coda solo dopo conferma di scrittura dal server —
// riaprire l'app prima che la sync sia completata non ricrea l'item
// (resta lo stesso record IndexedDB, non un duplicato).
// ============================================================

const DB_NAME = "iterup-offline";
const DB_VERSION = 1;
const STORE_NAME = "logs-queue";

export interface QueuedLogPayload {
  food_id: string;
  quantity_g: number;
  meal_type: string;
  logged_at: string;
}

export interface QueuedLog {
  clientId: string;
  payload: QueuedLogPayload;
  queuedAt: string;
}

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Genera un id client-side stabile per la deduplica. */
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueLog(clientId: string, payload: QueuedLogPayload): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ clientId, payload, queuedAt: new Date().toISOString() } satisfies QueuedLog);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueuedLogs(): Promise<QueuedLog[]> {
  if (!isIndexedDBAvailable()) return [];
  const db = await openDB();
  const items = await new Promise<QueuedLog[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedLog[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function removeQueuedLog(clientId: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Tenta di reinviare ogni log in coda. Ogni item rimosso solo dopo
 * una risposta 2xx dal server (conferma reale, non solo "la request è
 * partita"). Ritorna quanti sono stati sincronizzati con successo.
 */
export async function flushQueue(): Promise<number> {
  const items = await getQueuedLogs();
  let synced = 0;
  for (const item of items) {
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await removeQueuedLog(item.clientId);
        synced++;
      }
      // Risposta non-ok (es. 400/404 alimento cancellato nel frattempo):
      // lasciamo l'item in coda solo per errori di rete, non per errori
      // applicativi persistenti che si ripeterebbero all'infinito. Un
      // 4xx/5xx qui viene comunque rimosso per non bloccare la coda
      // all'infinito su un payload non più valido.
      else {
        await removeQueuedLog(item.clientId);
      }
    } catch {
      // Errore di rete (fetch stesso ha fallito): resta in coda, si
      // riprova al prossimo evento online/focus.
    }
  }
  return synced;
}
