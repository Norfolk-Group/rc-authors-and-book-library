/**
 * webSearch.ts — Web research helpers (Exa neural search + Perplexity answers).
 *
 * Two providers, both server-side (never call from the client):
 *  - Exa (exa.ai)       → neural web search with page contents   [EXA_API_KEY]
 *  - Perplexity (sonar) → cited answer synthesis                 [PERPLEXITY_API_KEY]
 *
 * Each function returns gracefully (empty/null) when its key is missing or the
 * API fails, so callers never throw on a misconfigured provider. The API key is
 * a parameter (defaulting to ENV) to keep the functions unit-testable.
 */
import { ENV } from "../_core/env";

const TIMEOUT_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExaResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
  score?: number;
}

export interface WebResearchResult {
  query: string;
  /** Perplexity-synthesised answer (null if Perplexity is unavailable). */
  answer: string | null;
  /** Citation URLs returned by Perplexity. */
  citations: string[];
  /** Exa web results (empty if Exa is unavailable). */
  sources: ExaResult[];
}

// ─── Exa ────────────────────────────────────────────────────────────────────

interface ExaApiResult {
  title?: string;
  url?: string;
  highlights?: string[];
  text?: string;
  publishedDate?: string;
  author?: string;
  score?: number;
}

/**
 * Neural web search via Exa. Returns up to `numResults` results, each with a
 * short text snippet. Returns [] when the key is missing or on error.
 */
export async function exaSearch(
  query: string,
  numResults = 8,
  apiKey: string = ENV.exaApiKey
): Promise<ExaResult[]> {
  if (!apiKey || !query.trim()) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          numResults,
          // "auto" = balanced relevance/speed (Exa's recommended default).
          type: "auto",
          // Highlights = query-relevant excerpts; the token-efficient mode Exa
          // recommends for agent/LLM workflows (vs. full `text`).
          contents: { highlights: true },
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.warn(`[Exa] API error: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: ExaApiResult[] };
    return (data.results ?? [])
      .map((r) => ({
        title: r.title || r.url || "Untitled",
        url: r.url || "",
        snippet: (r.highlights?.join(" … ") || r.text || "").replace(/\s+/g, " ").trim().slice(0, 300),
        publishedDate: r.publishedDate,
        author: r.author,
        score: r.score,
      }))
      .filter((r) => r.url);
  } catch (err) {
    console.warn("[Exa] search failed:", err);
    return [];
  }
}

// ─── Perplexity ──────────────────────────────────────────────────────────────

/**
 * Synthesise a cited answer via Perplexity (sonar-pro). Returns the answer text
 * plus citation URLs. Returns null when the key is missing or on error.
 */
export async function perplexityAnswer(
  query: string,
  apiKey: string = ENV.perplexityApiKey
): Promise<{ answer: string; citations: string[] } | null> {
  if (!apiKey || !query.trim()) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content:
                "You are a research assistant. Answer the user's question concisely and accurately using current web sources.",
            },
            { role: "user", content: query },
          ],
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.warn(`[Perplexity] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) return null;
    return {
      answer,
      citations: Array.isArray(data.citations) ? data.citations : [],
    };
  } catch (err) {
    console.warn("[Perplexity] answer failed:", err);
    return null;
  }
}

// ─── Combined web research ──────────────────────────────────────────────────

/**
 * Run Exa (sources) and Perplexity (cited answer) in parallel and merge them
 * into a single research result. Each provider degrades independently.
 */
export async function webResearch(
  query: string,
  numResults = 8
): Promise<WebResearchResult> {
  const [exa, pplx] = await Promise.allSettled([
    exaSearch(query, numResults),
    perplexityAnswer(query),
  ]);

  const sources = exa.status === "fulfilled" ? exa.value : [];
  const answerResult = pplx.status === "fulfilled" ? pplx.value : null;

  return {
    query,
    answer: answerResult?.answer ?? null,
    citations: answerResult?.citations ?? [],
    sources,
  };
}
