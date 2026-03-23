/**
 * rapidapi.ts — Phase B enrichment helpers using RapidAPI
 *
 * Covers: Yahoo Finance, CNBC, LinkedIn, Seeking Alpha (Bloomberg proxy)
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

// ─── CNBC ─────────────────────────────────────────────────────────────────────

export interface CNBCStats {
  articleCount: number;
  recentArticles: Array<{ title: string; url: string; date: string | null }>;
  latestArticleDate: string | null;
  fetchedAt: string;
}

/**
 * Search CNBC for articles mentioning an author via RapidAPI.
 * @param authorName - Full name of the author
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchCNBCStats(
  authorName: string,
  rapidApiKey: string
): Promise<CNBCStats | null> {
  if (!rapidApiKey) return null;

  try {
    // Use the CNBC search endpoint
    const res = await fetch(
      `https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=10000664&count=20`,
      {
        headers: {
          "x-rapidapi-host": "cnbc.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[CNBC] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: {
        articles?: Array<{
          title?: string;
          url?: string;
          datePublished?: string;
          author?: string;
        }>;
      };
    };

    const articles = data.data?.articles || [];

    // Filter articles that mention the author
    const authorLower = authorName.toLowerCase();
    const nameParts = authorLower.split(" ");
    const lastName = nameParts[nameParts.length - 1];

    const matching = articles.filter((a) => {
      const titleLower = (a.title || "").toLowerCase();
      const authorField = (a.author || "").toLowerCase();
      return (
        titleLower.includes(lastName) ||
        authorField.includes(authorLower) ||
        authorField.includes(lastName)
      );
    });

    const recentArticles = matching.slice(0, 5).map((a) => ({
      title: a.title || "",
      url: a.url || "",
      date: a.datePublished || null,
    }));

    const dates = recentArticles
      .map((a) => a.date)
      .filter(Boolean)
      .sort()
      .reverse();

    return {
      articleCount: matching.length,
      recentArticles,
      latestArticleDate: dates[0] || null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[CNBC] Error for ${authorName}:`, err);
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

// ─── Seeking Alpha (Bloomberg proxy) ─────────────────────────────────────────

export interface SeekingAlphaStats {
  articleCount: number;
  recentArticles: Array<{ title: string; url: string; date: string | null }>;
  latestArticleDate: string | null;
  fetchedAt: string;
}

/**
 * Search Seeking Alpha (Bloomberg-adjacent financial news) for author mentions.
 * @param authorName - Full name of the author
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchSeekingAlphaStats(
  authorName: string,
  rapidApiKey: string
): Promise<SeekingAlphaStats | null> {
  if (!rapidApiKey) return null;

  try {
    const res = await fetch(
      `https://seeking-alpha.p.rapidapi.com/news/v2/list?size=20&number=1`,
      {
        headers: {
          "x-rapidapi-host": "seeking-alpha.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[SeekingAlpha] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{
        attributes?: {
          title?: string;
          publishOn?: string;
          getUrl?: string;
        };
      }>;
    };

    const articles = data.data || [];
    const authorLower = authorName.toLowerCase();
    const nameParts = authorLower.split(" ");
    const lastName = nameParts[nameParts.length - 1];

    const matching = articles.filter((a) => {
      const title = (a.attributes?.title || "").toLowerCase();
      return title.includes(lastName);
    });

    const recentArticles = matching.slice(0, 5).map((a) => ({
      title: a.attributes?.title || "",
      url: a.attributes?.getUrl
        ? `https://seekingalpha.com${a.attributes.getUrl}`
        : "",
      date: a.attributes?.publishOn || null,
    }));

    const dates = recentArticles
      .map((a) => a.date)
      .filter(Boolean)
      .sort()
      .reverse();

    return {
      articleCount: matching.length,
      recentArticles,
      latestArticleDate: dates[0] || null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[SeekingAlpha] Error for ${authorName}:`, err);
    return null;
  }
}
