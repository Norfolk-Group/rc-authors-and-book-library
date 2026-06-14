/**
 * voyage.service.ts — Voyage AI embeddings + reranking, via REST.
 *
 * Used for the book-knowledge-base pipeline: each chunk of a book's PDF/DOC
 * content is embedded with voyage-4, then at query time the top-k from pgvector
 * is reranked with rerank-2.5-lite for sharper precision.
 *
 * No SDK dependency (Voyage's API is plain JSON); no native bindings.
 *
 * Models:
 *   - voyage-4 — 1024-dim, multilingual, $0.06/M tokens. Fits pgvector HNSW.
 *   - voyage-4-lite — cheaper, used for query-side embeddings if desired.
 *   - rerank-2.5-lite — cross-encoder rerank; ~free at our scale (200M tokens free).
 *
 * pgvector HNSW max dim is 2000, so we use Voyage's default 1024 (well within).
 * Switching from the current Gemini 1536-dim setup requires re-indexing — that's
 * a deliberate one-time cost, paid in the same window as the PDF backfill.
 */

import { ENV } from "../_core/env";

export const VOYAGE_EMBED_MODEL = "voyage-4";
export const VOYAGE_RERANK_MODEL = "rerank-2.5-lite";
export const VOYAGE_EMBED_DIMENSION = 1024;

const VOYAGE_API_BASE = "https://api.voyageai.com/v1";

type EmbedInputType = "document" | "query";

function authHeaders(): Record<string, string> {
  if (!ENV.voyageApiKey) {
    throw new Error("VOYAGE_API_KEY is not configured");
  }
  return {
    authorization: `Bearer ${ENV.voyageApiKey}`,
    "content-type": "application/json",
  };
}

async function callVoyage<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${VOYAGE_API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Voyage ${path} failed: ${resp.status} ${resp.statusText} - ${text}`);
  }
  return (await resp.json()) as T;
}

type VoyageEmbedResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens?: number };
};

/**
 * Embed a single text (1024 dims). Documents and queries should use
 * matching input_type for best retrieval quality.
 */
export async function voyageEmbedOne(
  text: string,
  inputType: EmbedInputType = "document"
): Promise<number[]> {
  const { data } = await callVoyage<VoyageEmbedResponse>("/embeddings", {
    model: VOYAGE_EMBED_MODEL,
    input: [text],
    input_type: inputType,
  });
  const values = data?.[0]?.embedding;
  if (!values || values.length === 0) {
    throw new Error("Voyage embedding returned empty values");
  }
  return values;
}

/**
 * Embed many texts. Voyage allows up to 128 inputs per request; we batch
 * conservatively and add a short delay between batches to stay polite.
 */
export async function voyageEmbedBatch(
  texts: string[],
  inputType: EmbedInputType = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const BATCH = 64;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const { data } = await callVoyage<VoyageEmbedResponse>("/embeddings", {
      model: VOYAGE_EMBED_MODEL,
      input: slice,
      input_type: inputType,
    });
    // Response order is guaranteed by `index`; sort defensively.
    const ordered = [...data].sort((a, b) => a.index - b.index);
    for (const row of ordered) out.push(row.embedding);
    if (i + BATCH < texts.length) await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

type VoyageRerankResponse = {
  data: Array<{ index: number; relevance_score: number }>;
};

export type RerankInput<T> = { id: T; text: string };
export type RerankResult<T> = { id: T; text: string; score: number };

/**
 * Rerank candidates against a query and return them sorted by relevance.
 * The output has the same shape as the input plus a `score`; ids preserve the
 * caller's type so this drops into any RAG pipeline cleanly.
 */
export async function voyageRerank<T>(
  query: string,
  candidates: RerankInput<T>[],
  options: { topK?: number } = {}
): Promise<RerankResult<T>[]> {
  if (candidates.length === 0) return [];
  const topK = options.topK ?? candidates.length;
  const { data } = await callVoyage<VoyageRerankResponse>("/rerank", {
    model: VOYAGE_RERANK_MODEL,
    query,
    documents: candidates.map((c) => c.text),
    top_k: topK,
  });
  return data.map((row) => ({
    id: candidates[row.index].id,
    text: candidates[row.index].text,
    score: row.relevance_score,
  }));
}
