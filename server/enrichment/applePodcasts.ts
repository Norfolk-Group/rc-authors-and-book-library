/**
 * Apple Podcasts / iTunes Search API helper — free, no API key required
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 *
 * Provides:
 *  - searchPodcasts(term, limit?)     → find podcasts by name or author
 *  - searchPodcastEpisodes(term, limit?) → find individual episodes
 *  - lookupPodcast(collectionId)      → get full podcast details by iTunes ID
 *  - getAuthorPodcasts(authorName, limit?) → podcasts hosted by or featuring an author
 */

const BASE = "https://itunes.apple.com";
const TIMEOUT_MS = 12_000;

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ITunesPodcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  feedUrl?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  primaryGenreName?: string;
  genreIds?: string[];
  genres?: string[];
  trackCount?: number;
  releaseDate?: string;
  country?: string;
  collectionViewUrl?: string;
  description?: string;
}

export interface ITunesEpisode {
  trackId: number;
  trackName: string;
  collectionName: string;
  artistName: string;
  description?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  episodeUrl?: string;
  artworkUrl160?: string;
  episodeGuid?: string;
}

interface ITunesSearchResponse<T> {
  resultCount: number;
  results: T[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Search for podcasts by term (show name, author, topic).
 */
export async function searchPodcasts(
  term: string,
  limit = 10
): Promise<ITunesPodcast[]> {
  const params = new URLSearchParams({
    term,
    media: "podcast",
    entity: "podcast",
    limit: String(Math.min(limit, 200)),
  });
  const data = await fetchJSON<ITunesSearchResponse<ITunesPodcast>>(
    `${BASE}/search?${params}`
  );
  return data?.results ?? [];
}

/**
 * Search for individual podcast episodes by term.
 */
export async function searchPodcastEpisodes(
  term: string,
  limit = 10
): Promise<ITunesEpisode[]> {
  const params = new URLSearchParams({
    term,
    media: "podcast",
    entity: "podcastEpisode",
    limit: String(Math.min(limit, 200)),
  });
  const data = await fetchJSON<ITunesSearchResponse<ITunesEpisode>>(
    `${BASE}/search?${params}`
  );
  return data?.results ?? [];
}

/**
 * Look up a podcast by its iTunes collection ID.
 */
export async function lookupPodcast(
  collectionId: number
): Promise<ITunesPodcast | null> {
  const params = new URLSearchParams({
    id: String(collectionId),
    media: "podcast",
    entity: "podcast",
  });
  const data = await fetchJSON<ITunesSearchResponse<ITunesPodcast>>(
    `${BASE}/lookup?${params}`
  );
  return data?.results?.[0] ?? null;
}

/**
 * Find podcasts hosted by or strongly associated with a given author name.
 * Returns podcasts where the artist name closely matches the author.
 */
export async function getAuthorPodcasts(
  authorName: string,
  limit = 10
): Promise<ITunesPodcast[]> {
  const results = await searchPodcasts(authorName, 25);
  // Prefer podcasts where the artist name matches the author
  const nameLower = authorName.toLowerCase();
  const exact = results.filter((p) =>
    p.artistName.toLowerCase().includes(nameLower) ||
    nameLower.includes(p.artistName.toLowerCase())
  );
  const rest = results.filter(
    (p) =>
      !p.artistName.toLowerCase().includes(nameLower) &&
      !nameLower.includes(p.artistName.toLowerCase())
  );
  return [...exact, ...rest].slice(0, limit);
}

/**
 * Build a high-res artwork URL from an iTunes artwork URL.
 * Replaces the size suffix (e.g. "100x100bb") with the requested size.
 */
export function getArtworkUrl(
  artworkUrl: string | undefined,
  size: 100 | 300 | 600 = 300
): string | undefined {
  if (!artworkUrl) return undefined;
  return artworkUrl.replace(/\d+x\d+bb/, `${size}x${size}bb`);
}
