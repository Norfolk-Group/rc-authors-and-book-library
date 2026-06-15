/**
 * modelResolver.ts
 *
 * Resolves the *latest* model ID per family from each provider's models API,
 * so the app automatically picks up new Opus / Sonnet / Gemini / Nano-Banana
 * releases without a code change — while staying safe against this project's
 * documented deployment-breakage history.
 *
 * Safety design ("resolver + safe fallback"):
 *   - Results are cached for 24h (one network round-trip per provider per day).
 *   - Every getter is total: on any error, empty list, or no confident match it
 *     returns a pinned, known-good fallback ID. It never throws.
 *   - Only bare canonical aliases are accepted (e.g. `claude-opus-4-8`), never
 *     dated snapshots or `-fast` / `-preview` variants — so a resolver result is
 *     always a stable, GA model.
 *
 * NOT resolved here: the embedding model (`gemini-embedding-001`) is pinned for
 * the pgvector 1536-dim HNSW constraint and must never change. Keep it out.
 */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { ENV } from "../_core/env";
import { logger } from "./logger";

export type ModelFamily = "opus" | "sonnet" | "gemini-text" | "gemini-image";

/** Known-good fallbacks — authoritative whenever resolution is unavailable or uncertain. */
export const PINNED_MODELS: Record<ModelFamily, string> = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  "gemini-text": "gemini-2.5-flash",
  "gemini-image": "gemini-2.5-flash-image",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { value: string; resolvedAt: number };
const cache = new Map<ModelFamily, CacheEntry>();
let inflight: Promise<void> | null = null;

// ── Pure selection helpers (exported for unit testing) ─────────────────────────

/** Extract numeric version components from a model id/name for ordering. */
export function versionKey(id: string): number[] {
  return (id.match(/\d+/g) ?? []).map(Number);
}

/** Compare two version keys descending (newest first). */
function byVersionDesc(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Pick the latest bare Anthropic alias for a family from a models list.
 * Accepts only `claude-opus-N-M` / `claude-sonnet-N-M` (no dated snapshots,
 * no `-fast` variants). Prefers newest `created_at`, then highest version.
 */
export function pickLatestAnthropic(
  models: Array<{ id: string; created_at?: string }>,
  family: "opus" | "sonnet"
): string | null {
  const re = new RegExp(`^claude-${family}-\\d+-\\d+$`);
  const matches = models.filter((m) => re.test(m.id));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const t = (b.created_at ?? "").localeCompare(a.created_at ?? "");
    if (t !== 0) return t;
    return byVersionDesc(versionKey(a.id), versionKey(b.id));
  });
  return matches[0].id;
}

/**
 * Pick the latest stable Gemini model for a family from a models list.
 * `gemini-text` → `gemini-<ver>-(flash|pro)`; `gemini-image` → a `gemini-…image`
 * model. Excludes preview/experimental/embedding/tts/vision/live variants so the
 * result is always a GA model. Highest version wins.
 */
export function pickLatestGemini(
  models: Array<{ name?: string }>,
  family: "gemini-text" | "gemini-image"
): string | null {
  const ids = models
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini-"))
    .filter((id) => !/(preview|exp|embedding|-tts|vision|live|thinking)/.test(id));

  const matches =
    family === "gemini-text"
      ? ids.filter((id) => /^gemini-[\d.]+-(flash|pro)$/.test(id))
      : ids.filter((id) => id.includes("image"));

  if (matches.length === 0) return null;
  matches.sort((a, b) => byVersionDesc(versionKey(a), versionKey(b)));
  return matches[0];
}

// ── Resolution (network) ───────────────────────────────────────────────────────

async function resolveAnthropic(): Promise<void> {
  if (!ENV.anthropicApiKey) return;
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  const models: Array<{ id: string; created_at?: string }> = [];
  for await (const m of client.models.list()) {
    models.push({ id: m.id, created_at: m.created_at });
  }
  const now = Date.now();
  const opus = pickLatestAnthropic(models, "opus");
  const sonnet = pickLatestAnthropic(models, "sonnet");
  if (opus) cache.set("opus", { value: opus, resolvedAt: now });
  if (sonnet) cache.set("sonnet", { value: sonnet, resolvedAt: now });
}

async function resolveGemini(): Promise<void> {
  if (!ENV.geminiApiKey) return;
  const ai = new GoogleGenAI({ apiKey: ENV.geminiApiKey });
  const models: Array<{ name?: string }> = [];
  const pager = await ai.models.list();
  for await (const m of pager) {
    models.push({ name: m.name });
  }
  const now = Date.now();
  const text = pickLatestGemini(models, "gemini-text");
  const image = pickLatestGemini(models, "gemini-image");
  if (text) cache.set("gemini-text", { value: text, resolvedAt: now });
  if (image) cache.set("gemini-image", { value: image, resolvedAt: now });
}

/** Refresh all providers once; concurrent callers share one in-flight refresh. */
async function refreshAll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const results = await Promise.allSettled([resolveAnthropic(), resolveGemini()]);
    for (const r of results) {
      if (r.status === "rejected") {
        logger.warn("[modelResolver] provider resolution failed; using pinned fallback", r.reason);
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Latest model ID for a family — cached, self-refreshing, and always safe.
 * Returns the pinned fallback if resolution is stale-and-unrefreshable.
 */
export async function getModel(family: ModelFamily): Promise<string> {
  const cached = cache.get(family);
  if (cached && Date.now() - cached.resolvedAt < CACHE_TTL_MS) return cached.value;
  try {
    await refreshAll();
  } catch (e) {
    logger.warn("[modelResolver] refresh threw; using pinned fallback", e);
  }
  return cache.get(family)?.value ?? PINNED_MODELS[family];
}

export const getOpusModel = () => getModel("opus");
export const getSonnetModel = () => getModel("sonnet");
export const getGeminiTextModel = () => getModel("gemini-text");
export const getGeminiImageModel = () => getModel("gemini-image");

/** Test-only: clear the resolver cache between cases. */
export function __resetModelCache(): void {
  cache.clear();
  inflight = null;
}
