/**
 * substack.ts — Substack enrichment for author profiles
 *
 * Uses two unofficial public endpoints (no auth required):
 *   1. /{subdomain}.substack.com/api/v1/archive — post count
 *   2. substack.com/profile/search/linkedin/{handle} — subscriber range
 *
 * Note: These are undocumented endpoints that may change without notice.
 */

export interface SubstackStats {
  substackUrl: string;
  subdomain: string;
  postCount: number;
  subscriberRange: string | null;
  followerCount: number | null;
  fetchedAt: string;
}

/**
 * Extract the subdomain from a Substack URL.
 * Handles: https://authorname.substack.com, authorname.substack.com
 */
export function extractSubstackSubdomain(substackUrl: string): string | null {
  if (!substackUrl) return null;
  const match = substackUrl.match(/([a-zA-Z0-9_-]+)\.substack\.com/i);
  return match ? match[1] : null;
}

/**
 * Count posts by paginating through the archive endpoint.
 * Uses a binary search approach: fetch at offset=0 to confirm existence,
 * then fetch at progressively higher offsets to estimate total count.
 */
async function countSubstackPosts(
  subdomain: string
): Promise<number> {
  const base = `https://${subdomain}.substack.com/api/v1/archive?sort=new&limit=12`;
  const headers = {
    "User-Agent": "authors-books-library/1.0",
    Accept: "application/json",
  };

  try {
    // Fetch first page to confirm existence
    const firstRes = await fetch(`${base}&offset=0`, { headers });
    if (!firstRes.ok) return 0;
    const firstPage = (await firstRes.json()) as unknown[];
    if (!Array.isArray(firstPage) || firstPage.length === 0) return 0;

    // Binary search for total count
    let lo = 0;
    let hi = 1200; // reasonable upper bound
    let lastSuccessOffset = 0;

    // Quick probe at 100, 300, 600, 1200
    for (const probe of [100, 300, 600, 1200]) {
      const res = await fetch(`${base}&offset=${probe}`, { headers });
      if (res.ok) {
        const page = (await res.json()) as unknown[];
        if (Array.isArray(page) && page.length > 0) {
          lastSuccessOffset = probe;
        } else {
          hi = probe;
          break;
        }
      } else {
        hi = probe;
        break;
      }
    }

    // Binary search between lastSuccessOffset and hi
    lo = lastSuccessOffset;
    while (lo + 12 < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const res = await fetch(`${base}&offset=${mid}`, { headers });
      if (res.ok) {
        const page = (await res.json()) as unknown[];
        if (Array.isArray(page) && page.length > 0) {
          lo = mid;
        } else {
          hi = mid;
        }
      } else {
        hi = mid;
      }
    }

    return lo + firstPage.length;
  } catch {
    return 0;
  }
}

/**
 * Fetch subscriber range via the official Substack LinkedIn search endpoint.
 * This requires the author's LinkedIn handle (username from LinkedIn URL).
 */
async function fetchSubstackSubscriberData(
  linkedinHandle: string | null
): Promise<{ subscriberRange: string | null; followerCount: number | null }> {
  if (!linkedinHandle) return { subscriberRange: null, followerCount: null };

  const headers = {
    "User-Agent": "authors-books-library/1.0",
    Accept: "application/json",
  };

  try {
    const res = await fetch(
      `https://substack.com/profile/search/linkedin/${encodeURIComponent(linkedinHandle)}`,
      { headers }
    );
    if (!res.ok) return { subscriberRange: null, followerCount: null };

    const data = (await res.json()) as Array<{
      roughNumFreeSubscribers?: string;
      followerCount?: number;
      leaderboardStatus?: string;
      bestsellerTier?: string;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return { subscriberRange: null, followerCount: null };
    }

    const profile = data[0];
    return {
      subscriberRange: profile.roughNumFreeSubscribers || null,
      followerCount: profile.followerCount || null,
    };
  } catch {
    return { subscriberRange: null, followerCount: null };
  }
}

/**
 * Fetch Substack stats for an author.
 * @param substackUrl - The author's Substack URL
 * @param linkedinHandle - Optional LinkedIn username for subscriber data
 */
export async function fetchSubstackStats(
  substackUrl: string,
  linkedinHandle?: string | null
): Promise<SubstackStats | null> {
  const subdomain = extractSubstackSubdomain(substackUrl);
  if (!subdomain) return null;

  const [postCount, subscriberData] = await Promise.all([
    countSubstackPosts(subdomain),
    fetchSubstackSubscriberData(linkedinHandle || null),
  ]);

  return {
    substackUrl,
    subdomain,
    postCount,
    subscriberRange: subscriberData.subscriberRange,
    followerCount: subscriberData.followerCount,
    fetchedAt: new Date().toISOString(),
  };
}
