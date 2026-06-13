/**
 * rapidapi.ts — Phase B enrichment helpers using RapidAPI
 *
 * Covers: Yahoo Finance, LinkedIn
 * (CNBC removed — required a paid RapidAPI plan, always returned HTTP 403)
 * (Seeking Alpha removed — not subscribed)
 *
 * All require RAPIDAPI_KEY environment variable.
 * Each function gracefully returns null if the key is missing or the API fails.
 */

// ─── Yahoo Finance ────────────────────────────────────────────────────────────

export interface YahooFinanceStats {
  ticker: string;
  shortName: string;
  regularMarketPrice: number | null;
  marketCap: number | null;
  currency: string | null;
  exchange: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fetchedAt: string;
}

/**
 * Fetch stock/company data from Yahoo Finance via RapidAPI.
 * @param ticker - Stock ticker symbol (e.g. "AAPL", "MSFT")
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchYahooFinanceStats(
  ticker: string,
  rapidApiKey: string
): Promise<YahooFinanceStats | null> {
  if (!rapidApiKey || !ticker) return null;

  try {
    const res = await fetch(
      `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${encodeURIComponent(ticker)}&type=STOCKS`,
      {
        headers: {
          "x-rapidapi-host": "yahoo-finance15.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[YahooFinance] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      body?: {
        shortName?: string;
        regularMarketPrice?: number;
        marketCap?: number;
        currency?: string;
        fullExchangeName?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
    };
    const body = data.body;
    if (!body) return null;

    return {
      ticker: ticker.toUpperCase(),
      shortName: body.shortName || ticker,
      regularMarketPrice: body.regularMarketPrice || null,
      marketCap: body.marketCap || null,
      currency: body.currency || null,
      exchange: body.fullExchangeName || null,
      fiftyTwoWeekHigh: body.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: body.fiftyTwoWeekLow || null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[YahooFinance] Error for ticker ${ticker}:`, err);
    return null;
  }
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

export interface LinkedInStats {
  followerCount: number | null;
  connectionCount: number | null;
  headline: string | null;
  profileUrl: string;
  fetchedAt: string;
}

/**
 * Fetch LinkedIn profile stats via RapidAPI scraper.
 * @param linkedinUrl - LinkedIn profile URL
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchLinkedInStats(
  linkedinUrl: string,
  rapidApiKey: string
): Promise<LinkedInStats | null> {
  if (!rapidApiKey || !linkedinUrl) return null;

  try {
    const res = await fetch(
      `https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url?url=${encodeURIComponent(linkedinUrl)}`,
      {
        headers: {
          "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[LinkedIn] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      followersCount?: number;
      connectionsCount?: number;
      headline?: string;
      profileUrl?: string;
    };

    return {
      followerCount: data.followersCount || null,
      connectionCount: data.connectionsCount || null,
      headline: data.headline || null,
      profileUrl: linkedinUrl,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[LinkedIn] Error for ${linkedinUrl}:`, err);
    return null;
  }
}

// ─── Seeking Alpha stub (kept for type compatibility, always returns null) ────

export interface SeekingAlphaStats {
  articleCount: number;
  recentArticles: Array<{ title: string; url: string; date: string | null }>;
  latestArticleDate: string | null;
  fetchedAt: string;
}

/**
 * Seeking Alpha integration removed (not subscribed to this RapidAPI endpoint).
 * Stub kept for backward compatibility with existing socialStatsJson data.
 */
export async function fetchSeekingAlphaStats(
  _authorName: string,
  _rapidApiKey: string
): Promise<SeekingAlphaStats | null> {
  return null;
}
