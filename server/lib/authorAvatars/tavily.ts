/**
 * tavily.ts — Tavily Image Search for author headshots
 *
 * Tier 2 in the avatar waterfall: fast (~1-2s), $0.001/search.
 * Best for business authors on LinkedIn, publisher sites, speaker bios.
 *
 * Exports:
 *   fetchTavilyAuthorPhoto   — returns the single best URL (used by waterfall.ts)
 *   fetchTavilyAuthorPhotos  — returns up to 4 ranked URLs (used by authorResearcher.ts)
 */

// ── Shared scoring ─────────────────────────────────────────────────────────────
function scoreImageUrl(url: string, nameParts: string[]): number {
  const lower = url.toLowerCase();
  let score = 0;

  // Authoritative sources (high trust)
  if (lower.includes("wikipedia") || lower.includes("wikimedia")) score += 15;
  if (lower.includes("linkedin")) score += 12;
  if (lower.includes("penguin") || lower.includes("harpercollins") || lower.includes("simonandschuster")) score += 10;
  if (lower.includes("ted.com") || lower.includes("tedx")) score += 10;
  if (lower.includes("official") || lower.includes("authorsite")) score += 8;
  if (lower.includes("headshot") || lower.includes("portrait")) score += 6;
  if (lower.includes("speaker") || lower.includes("keynote")) score += 5;
  if (lower.includes("press") || lower.includes("media")) score += 4;
  if (lower.includes("author") && !lower.includes("book")) score += 3;

  // Author name in URL is a strong signal it's their headshot
  if (nameParts.filter((p) => p.length > 3).every((p) => lower.includes(p))) score += 5;
  else if (nameParts.some((p) => p.length > 3 && lower.includes(p))) score += 2;

  // Slight recency bonus — not dominant
  if (lower.includes("2024") || lower.includes("2025") || lower.includes("2026")) score += 2;
  if (lower.includes("2023") || lower.includes("2022")) score += 1;

  // Penalise likely non-headshots
  if (lower.includes("book") && lower.includes("cover")) score -= 12;
  if (lower.includes("cover") && !lower.includes("author")) score -= 8;
  if (lower.includes("event") || lower.includes("conference") || lower.includes("panel")) score -= 5;
  if (lower.includes("group") || lower.includes("team") || lower.includes("staff")) score -= 8;
  if (lower.includes("amazon") && lower.includes("images")) score -= 3;
  if (lower.includes("thumb") || lower.includes("small")) score -= 3;

  return score;
}

function rankImages(images: string[], authorName: string): string[] {
  const nameParts = authorName.toLowerCase().split(" ");
  return images
    .map((url) => ({ url, score: scoreImageUrl(url, nameParts) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.url);
}

// ── Core fetch helper ──────────────────────────────────────────────────────────
async function tavilyImageSearch(query: string, maxResults = 10): Promise<string[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_images: true,
        include_image_descriptions: false,
        max_results: maxResults,
        days: 730,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.images as string[]) ?? [];
  } catch {
    return [];
  }
}

// ── Public exports ─────────────────────────────────────────────────────────────

/**
 * Returns the single best headshot URL for an author, or null if none found.
 * Used by the avatar waterfall (Tier 2).
 */
export async function fetchTavilyAuthorPhoto(authorName: string): Promise<string | null> {
  const currentYear = new Date().getFullYear();
  const query = `"${authorName}" author headshot photo ${currentYear} OR ${currentYear - 1} OR ${currentYear - 2}`;
  const images = await tavilyImageSearch(query, 10);
  if (!images.length) return null;
  return rankImages(images, authorName)[0] ?? null;
}

/**
 * Returns up to 4 ranked headshot URLs for an author.
 * Used by authorResearcher.ts for multi-candidate evaluation.
 */
export async function fetchTavilyAuthorPhotos(authorName: string): Promise<string[]> {
  const query = `"${authorName}" author headshot portrait professional photo`;
  const images = await tavilyImageSearch(query, 10);
  if (!images.length) return [];
  return rankImages(images, authorName).slice(0, 4);
}
