// ============================================================
// IterUp — client OpenRouter condiviso
// ------------------------------------------------------------
// Vedi PRD-addendum-openrouter.md. Regole vincolanti:
// - MAI "openrouter/auto": il campo `models` richiede una lista
//   esplicita di modelli scelti a monte (non passata da qui).
// - `provider: { sort: "price" }` per instradare al provider più
//   economico dello STESSO modello (sicuro, non cambia qualità).
// - Ogni chiamata logga: modello richiesto, modello effettivo
//   (risposta.model), esito, e se disponibile il costo stimato.
// - JSON parsing fallito -> retry (max 2 tentativi) prima di
//   propagare l'errore al chiamante.
//
// Questo modulo fornisce solo il meccanismo di trasporto: i modelli
// da usare (env OPENROUTER_MODELS, vedi sotto) e lo schema JSON delle
// risposte sono decisioni di prodotto prese altrove (A3 generatore
// pasti, generatore integratori, chat Q&A) — non hardcodare qui
// scelte che spettano al PRD-addendum-openrouter.md sezioni 2 e 6.
// ============================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterCallOptions {
  /** Lista esplicita di modelli in ordine di fallback (mai openrouter/auto). */
  models: string[];
  messages: OpenRouterMessage[];
  /** Forza risposta JSON valida se il modello lo supporta. */
  jsonMode?: boolean;
  /** Tools aggiuntivi, es. [{ type: "openrouter:web_search" }] per la chat integratori. */
  tools?: Record<string, unknown>[];
  temperature?: number;
}

export interface OpenRouterCallLog {
  modelsRequested: string[];
  modelUsed: string | null;
  outcome: "success" | "error" | "parse_error";
  costUsd: number | null;
  errorMessage?: string;
}

/** Citazione web da web search grounding (annotazione url_citation di OpenRouter). */
export interface OpenRouterCitation {
  url: string;
  title?: string;
}

export interface OpenRouterCallResult {
  content: string;
  /** Citazioni web se il modello ha usato tools: [{type: "openrouter:web_search"}]. */
  citations: OpenRouterCitation[];
  log: OpenRouterCallLog;
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("Manca OPENROUTER_API_KEY in .env.local");
  }
  return key;
}

/**
 * Chiamata "grezza" a OpenRouter: nessun retry, nessun parsing. Usata
 * sia per risposte testuali libere (chat) sia come building block per
 * chi vuole JSON strutturato (vedi callOpenRouterJSON).
 */
export async function callOpenRouter(options: OpenRouterCallOptions): Promise<OpenRouterCallResult> {
  const { models, messages, jsonMode, tools, temperature } = options;

  if (models.length === 0) {
    throw new Error("models non può essere vuoto (mai openrouter/auto, vedi PRD-addendum-openrouter.md)");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      models,
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(tools ? { tools } : {}),
      provider: { sort: "price" },
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json) {
    const log: OpenRouterCallLog = {
      modelsRequested: models,
      modelUsed: json?.model ?? null,
      outcome: "error",
      costUsd: null,
      errorMessage: json?.error?.message ?? `HTTP ${res.status}`,
    };
    console.error("OpenRouter call failed", log);
    throw Object.assign(new Error(log.errorMessage), { log });
  }

  const content: string | undefined = json.choices?.[0]?.message?.content;
  const modelUsed: string | null = json.model ?? null;
  const costUsd: number | null = json.usage?.cost ?? null;

  // Annotazioni url_citation della risposta (web search grounding),
  // vedi PRD-addendum-onboarding-form.md sezione 5.3. Lo shape esatto
  // (nidificato in `url_citation` vs campi piatti) non è documentato
  // in modo definitivo qui: gestiamo entrambe le forme in modo
  // difensivo invece di assumerne una sola.
  const rawAnnotations: unknown[] = json.choices?.[0]?.message?.annotations ?? [];
  const citations: OpenRouterCitation[] = rawAnnotations
    .map((a): OpenRouterCitation | null => {
      if (typeof a !== "object" || a === null) return null;
      const obj = a as Record<string, unknown>;
      if (obj.type !== "url_citation") return null;
      const nested = obj.url_citation as Record<string, unknown> | undefined;
      const url = (nested?.url ?? obj.url) as string | undefined;
      const title = (nested?.title ?? obj.title) as string | undefined;
      return typeof url === "string" ? { url, title } : null;
    })
    .filter((c): c is OpenRouterCitation => c !== null);

  const log: OpenRouterCallLog = {
    modelsRequested: models,
    modelUsed,
    outcome: "success",
    costUsd,
  };
  console.info("OpenRouter call", log);

  if (typeof content !== "string") {
    const errLog: OpenRouterCallLog = { ...log, outcome: "error", errorMessage: "Risposta senza content" };
    throw Object.assign(new Error(errLog.errorMessage), { log: errLog });
  }

  return { content, citations, log };
}

/**
 * Come callOpenRouter, ma forza jsonMode e fa il parse del content,
 * con fino a 2 retry se il JSON risulta non valido (vedi
 * PRD-addendum-openrouter.md sezione 5).
 */
export async function callOpenRouterJSON<T>(
  options: Omit<OpenRouterCallOptions, "jsonMode">,
  maxRetries = 2
): Promise<{ data: T; log: OpenRouterCallLog }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callOpenRouter({ ...options, jsonMode: true });
    try {
      const data = JSON.parse(result.content) as T;
      return { data, log: result.log };
    } catch (err) {
      lastError = err;
      const log: OpenRouterCallLog = { ...result.log, outcome: "parse_error" };
      console.error("OpenRouter JSON parse failed", log, result.content);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Parsing JSON fallito dopo i retry");
}
