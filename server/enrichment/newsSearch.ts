/**
 * News Search helper — aggregates author mentions via Google News RSS.
 *
 * Strategy (all server-side, no additional API keys needed):
 *  - Google News RSS (free, no key — covers NYT, Bloomberg, BBC, CNN, WSJ,
 *    Washington Post, The Atlantic, MSNBC, Apple News and more)
 *
 * Google News RSS returns articles from ALL major outlets in one feed.
 * We parse the RSS XML server-side and return structured article objects.
 *
 * Provides:
 *  - searchAuthorNews(authorName, limit?)   → articles mentioning the author
 *  - searchBookNews(bookTitle, authorName?) → articles mentioning the book
 */

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for news articles mentioning an author across major outlets via
 * Google News RSS.
 */
export async function searchAuthorNews(
  authorName: string,
  limit = 15
): Promise<NewsArticle[]> {
  return fetchGoogleNewsRSS(`"${authorName}" author book`, limit);
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
