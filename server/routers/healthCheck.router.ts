/**
 * Health Check Router
 * Pings each external service and returns status, latency, and error details.
 * Used by the Admin Console "Health" tab.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceStatus = "ok" | "degraded" | "error" | "unconfigured";

export interface ServiceHealthResult {
  service: string;
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  detail?: string;
  checkedAt: string; // ISO timestamp
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function timed<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

function unconfigured(service: string): ServiceHealthResult {
  return {
    service,
    status: "unconfigured",
    latencyMs: null,
    message: "API key / token not configured",
    checkedAt: new Date().toISOString(),
  };
}

function ok(service: string, latencyMs: number, message: string): ServiceHealthResult {
  return { service, status: "ok", latencyMs, message, checkedAt: new Date().toISOString() };
}

function degraded(service: string, latencyMs: number, message: string, detail?: string): ServiceHealthResult {
  return { service, status: "degraded", latencyMs, message, detail, checkedAt: new Date().toISOString() };
}

function error(service: string, latencyMs: number | null, message: string, detail?: string): ServiceHealthResult {
  return { service, status: "error", latencyMs, message, detail, checkedAt: new Date().toISOString() };
}

// ─── Individual Ping Functions ────────────────────────────────────────────────

async function checkApify(): Promise<ServiceHealthResult> {
  const token = ENV.apifyApiToken;
  if (!token) return unconfigured("Apify");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://api.apify.com/v2/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Apify", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    const data = await res.json();
    const plan = data?.data?.plan?.id ?? "unknown";
    const credits = data?.data?.monthlyUsage?.actorComputeUnits ?? null;
    return ok("Apify", latencyMs, `Plan: ${plan}${credits !== null ? ` · ${credits} CUs used` : ""}`);
  } catch (e: unknown) {
    return error("Apify", null, "Network error", String(e));
  }
}

async function checkGemini(): Promise<ServiceHealthResult> {
  const key = ENV.geminiApiKey;
  if (!key) return unconfigured("Google Gemini");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Hi" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        }
      )
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Google Gemini", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    return ok("Google Gemini", latencyMs, "gemini-2.0-flash reachable");
  } catch (e: unknown) {
    return error("Google Gemini", null, "Network error", String(e));
  }
}

async function checkAnthropic(): Promise<ServiceHealthResult> {
  const key = ENV.anthropicApiKey;
  if (!key) return unconfigured("Anthropic (Claude)");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      })
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Anthropic (Claude)", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    return ok("Anthropic (Claude)", latencyMs, "claude-3-haiku reachable");
  } catch (e: unknown) {
    return error("Anthropic (Claude)", null, "Network error", String(e));
  }
}

async function checkReplicate(): Promise<ServiceHealthResult> {
  const token = ENV.replicateApiToken;
  if (!token) return unconfigured("Replicate");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Replicate", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    const data = await res.json();
    const username = data?.username ?? "unknown";
    return ok("Replicate", latencyMs, `Account: ${username}`);
  } catch (e: unknown) {
    return error("Replicate", null, "Network error", String(e));
  }
}

async function checkYouTube(): Promise<ServiceHealthResult> {
  const key = ENV.youtubeApiKey;
  if (!key) return unconfigured("YouTube Data API");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${key}`
      )
    );
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason ?? "forbidden";
      if (reason === "quotaExceeded") {
        return degraded("YouTube Data API", latencyMs, "Quota exceeded for today", "Daily quota limit reached");
      }
      return error("YouTube Data API", latencyMs, `Forbidden: ${reason}`, JSON.stringify(body).slice(0, 200));
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("YouTube Data API", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    return ok("YouTube Data API", latencyMs, "Key valid, quota available");
  } catch (e: unknown) {
    return error("YouTube Data API", null, "Network error", String(e));
  }
}

async function checkTwitter(): Promise<ServiceHealthResult> {
  const token = ENV.twitterBearerToken;
  if (!token) return unconfigured("Twitter/X API");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    if (res.status === 401) {
      return error("Twitter/X API", latencyMs, "Invalid Bearer Token", "Token rejected by Twitter API");
    }
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail ?? "Forbidden";
      return degraded("Twitter/X API", latencyMs, "Token valid but insufficient tier", detail);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Twitter/X API", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    const data = await res.json();
    const username = data?.data?.username ?? "unknown";
    return ok("Twitter/X API", latencyMs, `Authenticated as @${username}`);
  } catch (e: unknown) {
    return error("Twitter/X API", null, "Network error", String(e));
  }
}

async function checkTavily(): Promise<ServiceHealthResult> {
  const key = ENV.tavilyApiKey;
  if (!key) return unconfigured("Tavily Search");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: "test", max_results: 1 }),
      })
    );
    if (res.status === 401 || res.status === 403) {
      return error("Tavily Search", latencyMs, "Invalid API key", `HTTP ${res.status}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Tavily Search", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    return ok("Tavily Search", latencyMs, "Key valid, search reachable");
  } catch (e: unknown) {
    return error("Tavily Search", null, "Network error", String(e));
  }
}

async function checkPerplexity(): Promise<ServiceHealthResult> {
  const key = ENV.perplexityApiKey;
  if (!key) return unconfigured("Perplexity AI");
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
        }),
      })
    );
    if (res.status === 401) {
      return error("Perplexity AI", latencyMs, "Invalid API key", "HTTP 401 Unauthorized");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("Perplexity AI", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    return ok("Perplexity AI", latencyMs, "sonar model reachable");
  } catch (e: unknown) {
    return error("Perplexity AI", null, "Network error", String(e));
  }
}

async function checkRapidApi(): Promise<ServiceHealthResult> {
  const key = ENV.rapidApiKey;
  if (!key) return unconfigured("RapidAPI");
  // Ping the Yahoo Finance endpoint as a lightweight check
  try {
    const { result: res, latencyMs } = await timed(() =>
      fetch("https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=AAPL&type=STOCKS", {
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
        },
      })
    );
    if (res.status === 401 || res.status === 403) {
      return error("RapidAPI", latencyMs, "Invalid API key or not subscribed to endpoint", `HTTP ${res.status}`);
    }
    if (res.status === 429) {
      return degraded("RapidAPI", latencyMs, "Rate limit hit", "Too many requests");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return error("RapidAPI", latencyMs, `HTTP ${res.status}`, body.slice(0, 200));
    }
    return ok("RapidAPI", latencyMs, "Yahoo Finance endpoint reachable");
  } catch (e: unknown) {
    return error("RapidAPI", null, "Network error", String(e));
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const healthCheckRouter = router({
  /**
   * Run health check for a single named service.
   */
  checkService: publicProcedure
    .input(
      z.object({
        service: z.enum([
          "apify",
          "gemini",
          "anthropic",
          "replicate",
          "youtube",
          "twitter",
          "tavily",
          "perplexity",
          "rapidapi",
        ]),
      })
    )
    .mutation(async ({ input }): Promise<ServiceHealthResult> => {
      switch (input.service) {
        case "apify":      return checkApify();
        case "gemini":     return checkGemini();
        case "anthropic":  return checkAnthropic();
        case "replicate":  return checkReplicate();
        case "youtube":    return checkYouTube();
        case "twitter":    return checkTwitter();
        case "tavily":     return checkTavily();
        case "perplexity": return checkPerplexity();
        case "rapidapi":   return checkRapidApi();
      }
    }),

  /**
   * Run health checks for ALL services in parallel and return results.
   */
  checkAll: publicProcedure.mutation(async (): Promise<ServiceHealthResult[]> => {
    const results = await Promise.allSettled([
      checkApify(),
      checkGemini(),
      checkAnthropic(),
      checkReplicate(),
      checkYouTube(),
      checkTwitter(),
      checkTavily(),
      checkPerplexity(),
      checkRapidApi(),
    ]);

    return results.map((r, i) => {
      const services = [
        "Apify", "Google Gemini", "Anthropic (Claude)", "Replicate",
        "YouTube Data API", "Twitter/X API", "Tavily Search",
        "Perplexity AI", "RapidAPI",
      ];
      if (r.status === "fulfilled") return r.value;
      return error(services[i], null, "Unexpected error", String(r.reason));
    });
  }),
});
