/**
 * wikipedia.ts — Wikimedia REST API enrichment for author profiles
 *
 * Uses the public Wikimedia REST API (no auth required).
 * Endpoints used:
 *   - /page/summary/{title}  — article existence, description, thumbnail
 *   - /metrics/pageviews/per-article — monthly page views (last 3 months avg)
 *
 * Rate limit: 200 req/s (very generous)
 */

const WIKI_REST_BASE = "https://en.wikipedia.org/api/rest_v1";
const WIKI_ANALYTICS_BASE = "https://wikimedia.org/api/rest_v1";

export interface WikipediaStats {
  pageTitle: string;
  pageUrl: string;
  description: string | null;
  extract: string | null;
  thumbnailUrl: string | null;
  avgMonthlyViews: number;
  fetchedAt: string;
}

/**
 * Normalize an author name to a Wikipedia-style title (spaces → underscores).
 */
function toWikiTitle(name: string): string {
  return name.trim().replace(/\s+/g, "_");
}

/**
 * Get the date string in YYYYMMDD format for n months ago.
 */
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7).replace("-", "") + "01";
}

/**
 * Fetch Wikipedia stats for an author.
 * @param authorName - Full name of the author (e.g. "Malcolm Gladwell")
 * @param wikipediaUrl - Optional existing Wikipedia URL to extract title from
 */
export async function fetchWikipediaStats(
  authorName: string,
  wikipediaUrl?: string | null
): Promise<WikipediaStats | null> {
  // Determine page title
  let pageTitle: string;
  if (wikipediaUrl) {
    const match = wikipediaUrl.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
    pageTitle = match ? decodeURIComponent(match[1]) : toWikiTitle(authorName);
  } else {
    pageTitle = toWikiTitle(authorName);
  }

  const headers = {
    "User-Agent": "authors-books-library/1.0 (contact@norfolkai.com)",
    Accept: "application/json",
  };

  try {
    // Fetch page summary
    const summaryRes = await fetch(
      `${WIKI_REST_BASE}/page/summary/${encodeURIComponent(pageTitle)}`,
      { headers }
    );

    if (!summaryRes.ok) {
      // Try searching if direct lookup fails
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(authorName)}&limit=1`,
        { headers }
      );
      if (!searchRes.ok) return null;
      const searchData = (await searchRes.json()) as {
        pages: Array<{ title: string; key: string }>;
      };
      if (!searchData.pages?.length) return null;
      pageTitle = searchData.pages[0].key || searchData.pages[0].title;

      // Retry summary with found title
      const retryRes = await fetch(
        `${WIKI_REST_BASE}/page/summary/${encodeURIComponent(pageTitle)}`,
        { headers }
      );
      if (!retryRes.ok) return null;
      const retryData = await retryRes.json();
      return await buildStats(retryData, pageTitle, headers);
    }

    const summaryData = await summaryRes.json();
    return await buildStats(summaryData, pageTitle, headers);
  } catch (err) {
    console.error(`[Wikipedia] Error fetching stats for ${authorName}:`, err);
    return null;
  }
}

async function buildStats(
  summaryData: {
    title?: string;
    content_urls?: { desktop?: { page?: string } };
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
  },
  pageTitle: string,
  headers: Record<string, string>
): Promise<WikipediaStats> {
  const pageUrl =
    summaryData.content_urls?.desktop?.page ||
    `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;

  // Fetch page views for last 3 months
  let avgMonthlyViews = 0;
  try {
    const endDate = new Date().toISOString().slice(0, 7).replace("-", "") + "01";
    const startDate = monthsAgo(3);
    const viewsRes = await fetch(
      `${WIKI_ANALYTICS_BASE}/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(pageTitle)}/monthly/${startDate}/${endDate}`,
      { headers }
    );
    if (viewsRes.ok) {
      const viewsData = (await viewsRes.json()) as {
        items?: Array<{ views: number }>;
      };
      const items = viewsData.items || [];
      if (items.length > 0) {
        avgMonthlyViews = Math.round(
          items.reduce((sum, item) => sum + item.views, 0) / items.length
        );
      }
    }
  } catch {
    // Non-critical
  }

  return {
    pageTitle: summaryData.title || pageTitle,
    pageUrl,
    description: summaryData.description || null,
    extract: summaryData.extract
      ? summaryData.extract.slice(0, 500)
      : null,
    thumbnailUrl: summaryData.thumbnail?.source || null,
    avgMonthlyViews,
    fetchedAt: new Date().toISOString(),
  };
}
