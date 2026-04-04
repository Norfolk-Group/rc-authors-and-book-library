/**
 * News Search helper — aggregates author mentions across multiple outlets.
 *
 * Strategy (all server-side, no additional API keys needed):
 *  1. CNBC via RapidAPI (existing subscription — business/leadership news)
 *  2. Google News RSS (free, no key — covers NYT, Bloomberg, BBC, CNN, WSJ,
 *     Washington Post, The Atlantic, MSNBC, Apple News and more)
 *
 * Google News RSS returns articles from ALL major outlets in one feed.
 * We parse the RSS XML server-side and return structured article objects.
 *
 * Provides:
 *  - searchAuthorNews(authorName, limit?)   → articles mentioning the author
 *  - searchBookNews(bookTitle, authorName?) → articles mentioning the book
 *  - getCNBCAuthorMentions(authorName)      → CNBC-specific author mentions
 */

import { ENV } from "../_core/env";

const TIMEOUT_MS = 12_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  snippet?: string;
  imageUrl?: string;
}

// ─── Google News RSS ──────────────────────────────────────────────────────────

/**
 * Fetch Google News RSS for a query and parse articles.
 * Covers: NYT, Bloomberg, BBC, CNN, WSJ, WashPost, Atlantic, MSNBC, and many more.
 */
async function fetchGoogleNewsRSS(
  query: string,
  limit = 10
): Promise<NewsArticle[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LibraryBot/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const xml = await res.text();
    return parseRSSItems(xml, limit);
  } catch {
    return [];
  }
}

/**
 * Parse RSS XML into NewsArticle objects.
 * Handles Google News RSS format (items with title, link, pubDate, source, description).
 */
function parseRSSItems(xml: string, limit: number): NewsArticle[] {
  const items: NewsArticle[] = [];

  // Extract <item> blocks
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

  for (const itemXml of itemMatches.slice(0, limit)) {
    const title = extractTag(itemXml, "title")?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const link = extractTag(itemXml, "link")?.trim();
    const pubDate = extractTag(itemXml, "pubDate")?.trim();
    const sourceRaw = extractTag(itemXml, "source")?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const description = extractTag(itemXml, "description")?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();

    if (!title || !link) continue;

    items.push({
      title,
      url: link,
      source: sourceRaw ?? "Google News",
      publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
      snippet: description?.slice(0, 200),
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | undefined {
  const pattern = `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`;
  const match = xml.match(new RegExp(pattern, "i"));
  return match?.[1];
}

// ─── CNBC via RapidAPI ────────────────────────────────────────────────────────

/**
 * Search CNBC for articles mentioning an author.
 * Uses the existing CNBC RapidAPI subscription.
 */
export async function getCNBCAuthorMentions(
  authorName: string,
  limit = 10
): Promise<NewsArticle[]> {
  const key = ENV.rapidApiKey;
  if (!key) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // CNBC search endpoint
    const url = `https://cnbc.p.rapidapi.com/news/v2/list?tag=${encodeURIComponent(authorName)}&regionStr=US`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": "cnbc.p.rapidapi.com",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = data?.data?.newsStreamData?.data ?? [];

    return items.slice(0, limit).map((item) => ({
      title: String(item.headline ?? item.title ?? ""),
      url: String(item.url ?? item.promoUrl ?? ""),
      source: "CNBC",
      publishedAt: item.datePublished
        ? new Date(String(item.datePublished)).toISOString()
        : undefined,
      snippet: String(item.description ?? item.summary ?? "").slice(0, 200),
      imageUrl: String(item.promoImage?.url ?? ""),
    }));
  } catch {
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for news articles mentioning an author across all available outlets.
 * Merges CNBC results (business focus) + Google News RSS (broad coverage).
 * Deduplicates by URL.
 */
export async function searchAuthorNews(
  authorName: string,
  limit = 15
): Promise<NewsArticle[]> {
  const [cnbc, google] = await Promise.allSettled([
    getCNBCAuthorMentions(authorName, 5),
    fetchGoogleNewsRSS(`"${authorName}" author book`, limit),
  ]);

  const cnbcItems = cnbc.status === "fulfilled" ? cnbc.value : [];
  const googleItems = google.status === "fulfilled" ? google.value : [];

  // Merge, deduplicate by URL, CNBC first
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const item of [...cnbcItems, ...googleItems]) {
    if (item.url && !seen.has(item.url)) {
      seen.add(item.url);
      merged.push(item);
    }
  }

  return merged.slice(0, limit);
}

/**
 * Search for news articles mentioning a specific book.
 */
export async function searchBookNews(
  bookTitle: string,
  authorName?: string,
  limit = 10
): Promise<NewsArticle[]> {
  const query = authorName
    ? `"${bookTitle}" "${authorName}"`
    : `"${bookTitle}" book`;
  return fetchGoogleNewsRSS(query, limit);
}

/**
 * Get the latest business/leadership news from CNBC (not author-specific).
 * Useful for a "Business News" widget in the app.
 */
export async function getCNBCBusinessNews(
  tag: "Books" | "Leadership" | "Business" | "Technology" = "Books",
  limit = 10
): Promise<NewsArticle[]> {
  return getCNBCAuthorMentions(tag, limit);
}
