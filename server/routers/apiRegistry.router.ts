import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { apiRegistry } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

// ── Seed data — all APIs known to the app ─────────────────────────────────────
const API_SEED: Array<{
  apiKey: string;
  name: string;
  description: string;
  category: "books" | "news" | "social" | "finance" | "travel" | "utilities" | "ai" | "other";
  source: string;
  sourceUrl: string;
  rapidApiHost?: string;
  healthCheckUrl?: string;
  enabled: number;
  statusColor: "green" | "yellow" | "red";
  displayOrder: number;
}> = [
  // ── Books ──────────────────────────────────────────────────────────────────
  {
    apiKey: "open-library",
    name: "Open Library",
    description: "Free book metadata, ISBNs, cover images, and author works from the Internet Archive.",
    category: "books",
    source: "Internet Archive (free)",
    sourceUrl: "https://openlibrary.org/developers/api",
    healthCheckUrl: "https://openlibrary.org/search.json?q=Adam+Grant&limit=1",
    enabled: 1,
    statusColor: "green",
    displayOrder: 1,
  },
  {
    apiKey: "google-books",
    name: "Google Books API",
    description: "Book search, metadata, preview links, and cover images via Google Books.",
    category: "books",
    source: "Google (free)",
    sourceUrl: "https://developers.google.com/books",
    healthCheckUrl: "https://www.googleapis.com/books/v1/volumes?q=Adam+Grant",
    enabled: 1,
    statusColor: "green",
    displayOrder: 2,
  },
  {
    apiKey: "hathitrust",
    name: "HathiTrust Data API",
    description: "Check digital availability and full-text access across university library collections.",
    category: "books",
    source: "HathiTrust (free)",
    sourceUrl: "https://www.hathitrust.org/data",
    healthCheckUrl: "https://catalog.hathitrust.org/api/volumes/brief/isbn/9780525559474.json",
    enabled: 1,
    statusColor: "green",
    displayOrder: 3,
  },
  {
    apiKey: "rapidapi-all-books",
    name: "All Books API",
    description: "NYT bestseller data with title, image, description, author, publisher, Amazon URL, ISBN.",
    category: "books",
    source: "RapidAPI — yoginoit39",
    sourceUrl: "https://rapidapi.com/yoginoit39/api/all-books-api",
    rapidApiHost: "all-books-api.p.rapidapi.com",
    healthCheckUrl: "https://all-books-api.p.rapidapi.com/author/AdamGrant",
    enabled: 0,
    statusColor: "red",
    displayOrder: 4,
  },
  // ── News ───────────────────────────────────────────────────────────────────
  {
    apiKey: "google-news-rss",
    name: "Google News RSS",
    description: "Free Google News RSS feed — author mentions and book news without an API key.",
    category: "news",
    source: "Google (free RSS)",
    sourceUrl: "https://news.google.com/rss",
    healthCheckUrl: "https://news.google.com/rss/search?q=Adam+Grant&hl=en-US&gl=US&ceid=US:en",
    enabled: 1,
    statusColor: "green",
    displayOrder: 1,
  },
  {
    apiKey: "rapidapi-cnbc",
    name: "CNBC News API",
    description: "Business news and live market data from CNBC — author mentions in financial press.",
    category: "news",
    source: "RapidAPI — Api Dojo",
    sourceUrl: "https://rapidapi.com/apidojo/api/cnbc",
    rapidApiHost: "cnbc.p.rapidapi.com",
    healthCheckUrl: "https://cnbc.p.rapidapi.com/news/v2/list?tag=Articles&hasHeadline=true",
    enabled: 1,
    statusColor: "yellow",
    displayOrder: 2,
  },
  {
    apiKey: "rapidapi-twitter-news",
    name: "Twitter / X API",
    description: "Author Twitter profiles, follower counts, verified status, and recent tweets.",
    category: "news",
    source: "RapidAPI — Alexander Vikhorev",
    sourceUrl: "https://rapidapi.com/alexanderxbx/api/twitter-api45",
    rapidApiHost: "twitter-api45.p.rapidapi.com",
    healthCheckUrl: "https://twitter-api45.p.rapidapi.com/screenname.php?screenname=AdamMGrant",
    enabled: 1,
    statusColor: "green",
    displayOrder: 3,
  },
  {
    apiKey: "rapidapi-nytimes",
    name: "NY Times News API",
    description: "Latest news and media content from the New York Times, filtered by region and category.",
    category: "news",
    source: "RapidAPI — PeralStudio",
    sourceUrl: "https://rapidapi.com/PeralStudio/api/nytimes-news-api",
    rapidApiHost: "nytimes-news-api.p.rapidapi.com",
    healthCheckUrl: "https://nytimes-news-api.p.rapidapi.com/news?q=Adam+Grant",
    enabled: 0,
    statusColor: "yellow",
    displayOrder: 4,
  },
  // ── Social ─────────────────────────────────────────────────────────────────
  {
    apiKey: "rapidapi-instagram",
    name: "Instagram Scraper Stable API",
    description: "Author Instagram follower counts, bio, profile picture, and recent posts.",
    category: "social",
    source: "RapidAPI — RockSolid APIs",
    sourceUrl: "https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api",
    rapidApiHost: "instagram-scraper-stable-api.p.rapidapi.com",
    healthCheckUrl: "https://instagram-scraper-stable-api.p.rapidapi.com/v1/info?username_or_id_or_url=adamgrant",
    enabled: 0,
    statusColor: "yellow",
    displayOrder: 1,
  },
  {
    apiKey: "rapidapi-linkedin",
    name: "Real-Time LinkedIn Scraper API",
    description: "Author LinkedIn profile data — follower count, headline, connections.",
    category: "social",
    source: "RapidAPI — RockApis",
    sourceUrl: "https://rapidapi.com/rockapis-rockapis-default/api/linkedin-data-api",
    rapidApiHost: "linkedin-data-api.p.rapidapi.com",
    healthCheckUrl: "https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url?url=https://www.linkedin.com/in/adammgrant/",
    enabled: 0,
    statusColor: "red",
    displayOrder: 2,
  },
  {
    apiKey: "rapidapi-substack",
    name: "Substack Live",
    description: "Real-time unofficial Substack API — author subscriber counts and post data.",
    category: "social",
    source: "RapidAPI — GS Tech",
    sourceUrl: "https://rapidapi.com/gstech/api/substack-live",
    rapidApiHost: "substack-live.p.rapidapi.com",
    healthCheckUrl: "https://substack-live.p.rapidapi.com/profile?username=adamgrant",
    enabled: 0,
    statusColor: "yellow",
    displayOrder: 3,
  },
  // ── Utilities ──────────────────────────────────────────────────────────────
  {
    apiKey: "itunes-podcasts",
    name: "iTunes Search API (Podcasts)",
    description: "Free Apple/iTunes search API for author podcasts, episodes, and artwork.",
    category: "utilities",
    source: "Apple (free)",
    sourceUrl: "https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/",
    healthCheckUrl: "https://itunes.apple.com/search?term=Adam+Grant&media=podcast&limit=3",
    enabled: 1,
    statusColor: "green",
    displayOrder: 1,
  },
  {
    apiKey: "rapidapi-scrapeninja",
    name: "ScrapeNinja",
    description: "Web scraping API with rotating proxies — scrape any author or book page.",
    category: "utilities",
    source: "RapidAPI — Anthony",
    sourceUrl: "https://rapidapi.com/restyler/api/scrapeninja",
    rapidApiHost: "scrapeninja.p.rapidapi.com",
    healthCheckUrl: "https://scrapeninja.p.rapidapi.com/scrape?url=https://en.wikipedia.org/wiki/Adam_Grant",
    enabled: 1,
    statusColor: "green",
    displayOrder: 2,
  },
  {
    apiKey: "rapidapi-geodb",
    name: "GeoDB Cities",
    description: "Global city, region, and country data — author birthplace and location lookup.",
    category: "utilities",
    source: "RapidAPI — Michael Mogley",
    sourceUrl: "https://rapidapi.com/wirefreethought/api/geodb-cities",
    rapidApiHost: "wft-geo-db.p.rapidapi.com",
    healthCheckUrl: "https://wft-geo-db.p.rapidapi.com/v1/geo/cities?limit=3",
    enabled: 1,
    statusColor: "green",
    displayOrder: 3,
  },
  {
    apiKey: "rapidapi-tldr",
    name: "TLDRThis",
    description: "Summarize any URL or text using abstractive and extractive summarization models.",
    category: "ai",
    source: "RapidAPI — TLDRThis",
    sourceUrl: "https://rapidapi.com/tldrthishq/api/tldrthis",
    rapidApiHost: "tldrthis.p.rapidapi.com",
    healthCheckUrl: "https://tldrthis.p.rapidapi.com/v1/model/abstractive/summarize-url/?url=https://en.wikipedia.org/wiki/Adam_Grant&num_sentences=3&is_detailed=false",
    enabled: 0,
    statusColor: "yellow",
    displayOrder: 1,
  },
  {
    apiKey: "manus-llm",
    name: "Manus LLM (invokeLLM)",
    description: "Internal Manus AI — used for bio enrichment, RAG generation, and author research.",
    category: "ai",
    source: "Manus Platform (built-in)",
    sourceUrl: "https://manus.im",
    enabled: 1,
    statusColor: "green",
    displayOrder: 2,
  },
  {
    apiKey: "manus-image-gen",
    name: "Manus Image Generation",
    description: "Internal Manus image generation — used for AI author avatar portraits.",
    category: "ai",
    source: "Manus Platform (built-in)",
    sourceUrl: "https://manus.im",
    enabled: 1,
    statusColor: "green",
    displayOrder: 3,
  },
  // ── Finance ────────────────────────────────────────────────────────────────
  {
    apiKey: "rapidapi-yahoo-finance",
    name: "Yahoo Finance",
    description: "Stock quotes, company financials, and market data for author-linked companies.",
    category: "finance",
    source: "RapidAPI — yahoo-finance15",
    sourceUrl: "https://rapidapi.com/sparior/api/yahoo-finance15",
    rapidApiHost: "yahoo-finance15.p.rapidapi.com",
    healthCheckUrl: "https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=AAPL&type=STOCKS",
    enabled: 1,
    statusColor: "green",
    displayOrder: 1,
  },
];

// ── Router ────────────────────────────────────────────────────────────────────
export const apiRegistryRouter = router({
  /** List all API registry entries, optionally filtered by category */
  list: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(apiRegistry)
        .orderBy(asc(apiRegistry.category), asc(apiRegistry.displayOrder));
      if (input?.category) {
        return rows.filter((r: typeof rows[0]) => r.category === input.category);
      }
      return rows;
    }),

  /** Toggle enabled/disabled for a single API */
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(apiRegistry)
        .set({ enabled: input.enabled ? 1 : 0 })
        .where(eq(apiRegistry.id, input.id));
      return { success: true };
    }),

  /** Update notes for a single API */
  updateNotes: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(apiRegistry)
        .set({ notes: input.notes })
        .where(eq(apiRegistry.id, input.id));
      return { success: true };
    }),

  /** Ping a single API and update its status */
  ping: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, statusColor: "red", statusCode: 0, message: "DB unavailable" };
      const [entry] = await db
        .select()
        .from(apiRegistry)
        .where(eq(apiRegistry.id, input.id));
      if (!entry || !entry.healthCheckUrl) {
        return { success: false, message: "No health check URL configured" };
      }

      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";
      const headers: Record<string, string> = {};
      if (entry.rapidApiHost) {
        headers["x-rapidapi-key"] = RAPIDAPI_KEY;
        headers["x-rapidapi-host"] = entry.rapidApiHost;
      }

      let statusCode = 0;
      let statusColor: "green" | "yellow" | "red" = "red";
      let message = "Unknown error";

      try {
        const res = await fetch(entry.healthCheckUrl, {
          headers,
          signal: AbortSignal.timeout(10000),
        });
        statusCode = res.status;
        const text = await res.text();
        const isNotSubscribed = res.status === 403 && text.includes("not subscribed");
        if (isNotSubscribed) {
          statusColor = "red";
          message = "Not subscribed";
        } else if (res.status >= 200 && res.status < 300) {
          statusColor = "green";
          message = `OK (${res.status})`;
        } else if (res.status === 404 && text.includes("doesn't exists")) {
          statusColor = "yellow";
          message = "Subscribed — endpoint needs update";
        } else if (res.status >= 400 && res.status < 500) {
          statusColor = "yellow";
          message = `Subscribed — ${res.status}`;
        } else {
          statusColor = "red";
          message = `Error ${res.status}`;
        }
      } catch (e: unknown) {
        message = e instanceof Error ? e.message : "Fetch failed";
        statusColor = "red";
      }

      await db
        .update(apiRegistry)
        .set({
          statusColor,
          lastStatusCode: statusCode,
          lastStatusMessage: message,
          lastCheckedAt: new Date(),
        })
        .where(eq(apiRegistry.id, input.id));

      return { success: true, statusColor, statusCode, message };
    }),

  /** Ping all APIs and update their statuses */
  pingAll: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return [];
    const entries = await db.select().from(apiRegistry);
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";
    const results: Array<{ id: number; name: string; statusColor: string; message: string }> = [];

    for (const entry of entries) {
      if (!entry.healthCheckUrl) {
        results.push({ id: entry.id, name: entry.name, statusColor: "yellow", message: "No health check URL" });
        continue;
      }
      const headers: Record<string, string> = {};
      if (entry.rapidApiHost) {
        headers["x-rapidapi-key"] = RAPIDAPI_KEY;
        headers["x-rapidapi-host"] = entry.rapidApiHost;
      }
      let statusCode = 0;
      let statusColor: "green" | "yellow" | "red" = "red";
      let message = "Unknown";
      try {
        const res = await fetch(entry.healthCheckUrl, { headers, signal: AbortSignal.timeout(8000) });
        statusCode = res.status;
        const text = await res.text();
        const isNotSubscribed = res.status === 403 && text.includes("not subscribed");
        if (isNotSubscribed) {
          statusColor = "red"; message = "Not subscribed";
        } else if (res.status >= 200 && res.status < 300) {
          statusColor = "green"; message = `OK (${res.status})`;
        } else if (res.status === 404 && text.includes("doesn't exists")) {
          statusColor = "yellow"; message = "Subscribed — endpoint needs update";
        } else if (res.status >= 400 && res.status < 500) {
          statusColor = "yellow"; message = `Subscribed — ${res.status}`;
        } else {
          statusColor = "red"; message = `Error ${res.status}`;
        }
      } catch (e: unknown) {
        message = e instanceof Error ? e.message : "Fetch failed";
      }
      await db!.update(apiRegistry).set({
        statusColor, lastStatusCode: statusCode, lastStatusMessage: message, lastCheckedAt: new Date(),
      }).where(eq(apiRegistry.id, entry.id));
      results.push({ id: entry.id, name: entry.name, statusColor, message });
    }
    return results;
  }),

  /** Seed the registry with all known APIs (idempotent — skips existing keys) */
  seed: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { inserted: 0 };
    let inserted = 0;
    for (const api of API_SEED) {
      try {
        await db.insert(apiRegistry).ignore().values({
          ...api,
          rapidApiHost: api.rapidApiHost ?? null,
          healthCheckUrl: api.healthCheckUrl ?? null,
        });
        inserted++;
      } catch {
        // already exists — skip
      }
    }
    return { inserted };
  }),
});
