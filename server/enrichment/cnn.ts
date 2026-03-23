/**
 * cnn.ts — CNN article mentions enrichment for author profiles
 *
 * Uses the Apify CNN Article Scraper actor to search for author mentions.
 * APIFY_API_TOKEN is already set in the project environment.
 *
 * Data retrieved:
 *   - articleCount: number of CNN articles mentioning the author
 *   - recentArticles: up to 5 most recent article titles + URLs
 *   - latestArticleDate: date of most recent mention
 */

const APIFY_BASE = "https://api.apify.com/v2";

export interface CNNArticle {
  title: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
}

export interface CNNStats {
  articleCount: number;
  recentArticles: CNNArticle[];
  latestArticleDate: string | null;
  searchQuery: string;
  fetchedAt: string;
}

/**
 * Search CNN for articles mentioning an author.
 * @param authorName - Full name of the author
 * @param apifyToken - Apify API token
 */
export async function fetchCNNStats(
  authorName: string,
  apifyToken: string
): Promise<CNNStats | null> {
  if (!apifyToken) return null;

  const searchQuery = `"${authorName}"`;

  try {
    // Run the CNN scraper actor synchronously (waits for result)
    const runRes = await fetch(
      `${APIFY_BASE}/acts/filip_cicvarek~cnn-article-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQuery,
          maxItems: 10,
          proxyConfiguration: { useApifyProxy: true },
        }),
      }
    );

    if (!runRes.ok) {
      console.warn(`[CNN] Apify run failed: ${runRes.status}`);
      return null;
    }

    const items = (await runRes.json()) as Array<{
      title?: string;
      url?: string;
      publishedAt?: string;
      author?: string;
    }>;

    if (!Array.isArray(items)) return null;

    const articles: CNNArticle[] = items.slice(0, 5).map((item) => ({
      title: item.title || "",
      url: item.url || "",
      publishedAt: item.publishedAt || null,
      author: item.author || null,
    }));

    // Find the most recent article date
    const dates = articles
      .map((a) => a.publishedAt)
      .filter(Boolean)
      .sort()
      .reverse();

    return {
      articleCount: items.length,
      recentArticles: articles,
      latestArticleDate: dates[0] || null,
      searchQuery,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[CNN] Error fetching stats for ${authorName}:`, err);
    return null;
  }
}
