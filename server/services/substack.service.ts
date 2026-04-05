/**
 * substack.service.ts
 *
 * Fetches recent posts from an author's Substack publication via their RSS feed.
 * Uses rss-parser (already installed) — no API key required.
 *
 * Substack RSS feed URL format:
 *   https://{subdomain}.substack.com/feed
 *
 * We derive the subdomain from the stored substackUrl field, which may be in any of:
 *   - https://adamgrant.substack.com
 *   - https://adamgrant.substack.com/
 *   - adamgrant.substack.com
 *   - adamgrant  (just the subdomain)
 */

import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
    ],
  },
  timeout: 10_000,
});

export interface SubstackPost {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  excerpt: string;
  thumbnailUrl: string | null;
  isPaywalled: boolean;
}

export interface SubstackFeedResult {
  subdomain: string;
  publicationName: string;
  publicationDescription: string;
  publicationImageUrl: string | null;
  publicationUrl: string;
  posts: SubstackPost[];
}

/**
 * Extract the Substack subdomain from any of the supported URL formats.
 */
export function extractSubstackSubdomain(input: string): string | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim().toLowerCase();

  // Already just a subdomain (no dots except possibly .substack.com)
  if (!trimmed.includes("/") && !trimmed.includes("http")) {
    // Could be "adamgrant" or "adamgrant.substack.com"
    if (trimmed.endsWith(".substack.com")) {
      return trimmed.replace(".substack.com", "");
    }
    // If it has no dots at all, treat as raw subdomain
    if (!trimmed.includes(".")) {
      return trimmed;
    }
  }

  // Full URL: https://adamgrant.substack.com or https://adamgrant.substack.com/...
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const hostname = url.hostname; // e.g. "adamgrant.substack.com"
    if (hostname.endsWith(".substack.com")) {
      return hostname.replace(".substack.com", "");
    }
  } catch {
    // Not a valid URL — try regex
  }

  // Regex fallback
  const match = trimmed.match(/([a-z0-9-]+)\.substack\.com/);
  if (match) return match[1];

  return null;
}

/**
 * Fetch recent posts from a Substack publication.
 * @param substackUrl - The stored substackUrl field value (any supported format)
 * @param limit - Maximum number of posts to return (default 5)
 */
export async function fetchSubstackPosts(
  substackUrl: string,
  limit = 5
): Promise<SubstackFeedResult> {
  const subdomain = extractSubstackSubdomain(substackUrl);
  if (!subdomain) {
    throw new Error(`Cannot extract Substack subdomain from: "${substackUrl}"`);
  }

  const feedUrl = `https://${subdomain}.substack.com/feed`;

  let feed: Awaited<ReturnType<typeof parser.parseURL>>;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch Substack feed for "${subdomain}": ${msg}`);
  }

  const posts: SubstackPost[] = (feed.items ?? [])
    .slice(0, limit)
    .map((item) => {
      // Extract a clean excerpt from content:encoded or description
      const rawHtml =
        ((item as unknown) as Record<string, unknown>).contentEncoded as string ||
        item.content ||
        item.summary ||
        "";
      const excerpt = stripHtml(rawHtml).slice(0, 280).trim();

      // Try to extract thumbnail from content:encoded
      const thumbnailUrl = extractFirstImage(rawHtml);

      // Substack marks paywalled posts by having very short content
      const isPaywalled = rawHtml.length > 0 && excerpt.length < 60;

      return {
        id: item.guid ?? item.link ?? item.title ?? "",
        title: item.title ?? "Untitled",
        url: item.link ?? `https://${subdomain}.substack.com`,
        publishedAt: item.pubDate ?? item.isoDate ?? null,
        excerpt: excerpt || "Subscribe to read this post.",
        thumbnailUrl,
        isPaywalled,
      };
    });

  return {
    subdomain,
    publicationName: feed.title ?? subdomain,
    publicationDescription: stripHtml(feed.description ?? "").slice(0, 300),
    publicationImageUrl: feed.image?.url ?? null,
    publicationUrl: feed.link ?? `https://${subdomain}.substack.com`,
    posts,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractFirstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}
