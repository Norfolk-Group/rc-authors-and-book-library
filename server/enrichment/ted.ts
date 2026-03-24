/**
 * ted.ts — TED.com scraper for author talks
 *
 * Uses Apify cheerio-scraper to extract TED talk data for a given author.
 * Results include talk titles, URLs, view counts, and publication dates.
 *
 * Pipeline:
 *   1. Search TED.com/talks for "{authorName}" via Apify
 *   2. Parse talk cards: title, url, viewCount, duration, publishedAt
 *   3. Return structured TEDTalkData for storage in author_profiles
 *
 * Cost: ~$0.001 per author (Apify cheerio-scraper)
 * Speed: ~5-15 seconds per author
 */

import { ApifyClient } from "apify-client";

export interface TEDTalk {
  title: string;
  url: string;
  viewCount: number | null;
  duration: string | null;
  publishedAt: string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

export interface TEDAuthorData {
  authorName: string;
  speakerUrl: string | null;
  talkCount: number;
  talks: TEDTalk[];
  totalViews: number;
  enrichedAt: string;
}

// ── Apify scraper ──────────────────────────────────────────────────────────────

const TED_SEARCH_URL = "https://www.ted.com/talks?sort=relevance&q=";

/**
 * Scrape TED.com for talks by a given author name.
 * Returns up to 5 talks sorted by view count.
 */
export async function scrapeTEDTalks(authorName: string): Promise<TEDAuthorData | null> {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    console.warn("[TED] APIFY_API_TOKEN not set — skipping TED scrape");
    return null;
  }

  const client = new ApifyClient({ token: apiToken });
  const searchUrl = `${TED_SEARCH_URL}${encodeURIComponent(authorName)}`;

  try {
    const run = await client.actor("apify/cheerio-scraper").call({
      startUrls: [{ url: searchUrl }],
      pageFunction: `
        async function pageFunction(context) {
          const { $, request } = context;
          const talks = [];
          // TED search results: each talk card
          $('[data-testid="search-result-card"], .media__message, .talk-link, article').each(function() {
            const el = $(this);
            // Title
            const titleEl = el.find('h4, h3, .media__message h4, [data-testid="talk-title"]').first();
            const title = titleEl.text().trim();
            if (!title) return;
            // URL
            const linkEl = el.find('a[href*="/talks/"]').first();
            const href = linkEl.attr('href') || '';
            const url = href.startsWith('http') ? href : 'https://www.ted.com' + href;
            // View count
            const viewText = el.find('[data-testid="view-count"], .meta__val, .talk__viewed-count').first().text().trim();
            const viewCount = parseViewCount(viewText);
            // Duration
            const duration = el.find('[data-testid="duration"], .meta__val--duration, time').first().text().trim() || null;
            // Published date
            const dateText = el.find('[data-testid="date"], .meta__val--date, time[datetime]').first().attr('datetime') || 
                             el.find('.meta__val--date').first().text().trim() || null;
            // Description
            const desc = el.find('[data-testid="description"], .media__message p, .talk__description').first().text().trim() || null;
            // Thumbnail
            const thumb = el.find('img').first().attr('src') || el.find('img').first().attr('data-src') || null;
            if (url.includes('/talks/')) {
              talks.push({ title, url, viewCount, duration, publishedAt: dateText, description: desc, thumbnailUrl: thumb });
            }
          });
          return { talks, searchUrl: request.url };
          function parseViewCount(text) {
            if (!text) return null;
            const clean = text.replace(/[^0-9.KMB]/gi, '').toUpperCase();
            if (clean.endsWith('M')) return Math.round(parseFloat(clean) * 1_000_000);
            if (clean.endsWith('K')) return Math.round(parseFloat(clean) * 1_000);
            if (clean.endsWith('B')) return Math.round(parseFloat(clean) * 1_000_000_000);
            const n = parseInt(clean, 10);
            return isNaN(n) ? null : n;
          }
        }
      `,
      maxRequestsPerCrawl: 2,
      maxConcurrency: 1,
    }, { waitSecs: 60 });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return null;

    const result = items[0] as { talks?: TEDTalk[] };
    const rawTalks: TEDTalk[] = result.talks ?? [];

    // Filter to talks that are likely by this author (name in URL or title)
    const nameParts = authorName.toLowerCase().split(" ");
    const relevantTalks = rawTalks.filter((t) => {
      const lower = (t.title + " " + t.url).toLowerCase();
      return nameParts.some((p) => p.length > 3 && lower.includes(p));
    });

    // Use all talks if filtering is too strict
    const talks = (relevantTalks.length > 0 ? relevantTalks : rawTalks)
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 5);

    if (talks.length === 0) return null;

    const totalViews = talks.reduce((sum, t) => sum + (t.viewCount ?? 0), 0);

    // Try to find the speaker's TED profile URL
    const speakerSlug = authorName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const speakerUrl = `https://www.ted.com/speakers/${speakerSlug}`;

    return {
      authorName,
      speakerUrl,
      talkCount: talks.length,
      talks,
      totalViews,
      enrichedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[TED] Scrape failed for "${authorName}":`, err);
    return null;
  }
}

/**
 * Lightweight TED profile check — fetches the speaker page directly
 * without Apify to verify the speaker exists and get their profile URL.
 */
export async function checkTEDSpeakerProfile(authorName: string): Promise<string | null> {
  const slug = authorName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const url = `https://www.ted.com/speakers/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NCGLibrary/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return url;
    // Try first_last format
    const parts = authorName.toLowerCase().split(" ");
    if (parts.length >= 2) {
      const altSlug = `${parts[0]}_${parts[parts.length - 1]}`;
      const altUrl = `https://www.ted.com/speakers/${altSlug}`;
      const altRes = await fetch(altUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NCGLibrary/1.0)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (altRes.ok) return altUrl;
    }
    return null;
  } catch {
    return null;
  }
}
