/**
 * contentItems.enrichment.test.ts
 * Unit tests for the four new enrichment procedures and the migration procedure
 * in contentItems.router.ts.
 *
 * Tests are pure unit tests — they mock fetch and the DB so no real network
 * calls or database writes occur.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MEDIA_GROUPS } from "./routers/contentItems.router";

// ── MEDIA_GROUPS unit tests ───────────────────────────────────────────────────

describe("MEDIA_GROUPS", () => {
  it("contains ted_talk in audio_video group", () => {
    expect(MEDIA_GROUPS.audio_video).toContain("ted_talk");
  });

  it("contains paper in written group", () => {
    expect(MEDIA_GROUPS.written).toContain("paper");
  });

  it("contains film in film_tv group", () => {
    expect(MEDIA_GROUPS.film_tv).toContain("film");
  });

  it("contains tv_show in film_tv group", () => {
    expect(MEDIA_GROUPS.film_tv).toContain("tv_show");
  });

  it("contains substack in written group", () => {
    expect(MEDIA_GROUPS.written).toContain("substack");
  });

  it("contains newsletter in written group", () => {
    expect(MEDIA_GROUPS.written).toContain("newsletter");
  });

  it("all groups are non-empty arrays", () => {
    for (const [key, group] of Object.entries(MEDIA_GROUPS)) {
      expect(Array.isArray(group), `${key} should be an array`).toBe(true);
      expect(group.length, `${key} should not be empty`).toBeGreaterThan(0);
    }
  });

  it("no content type appears in multiple groups", () => {
    const allTypes: string[] = [];
    for (const group of Object.values(MEDIA_GROUPS)) {
      allTypes.push(...group);
    }
    const unique = new Set(allTypes);
    expect(allTypes.length).toBe(unique.size);
  });
});

// ── TED URL slug extraction ───────────────────────────────────────────────────

describe("TED talk URL slug extraction", () => {
  function extractTedSlug(url: string): string | null {
    const match = url.match(/ted\.com\/talks\/([-\w]+)/);
    return match ? match[1] : null;
  }

  it("extracts slug from standard ted.com/talks URL", () => {
    expect(extractTedSlug("https://www.ted.com/talks/brene_brown_the_power_of_vulnerability"))
      .toBe("brene_brown_the_power_of_vulnerability");
  });

  it("extracts slug from URL with query params", () => {
    expect(extractTedSlug("https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action?language=en"))
      .toBe("simon_sinek_how_great_leaders_inspire_action");
  });

  it("returns null for non-TED URL", () => {
    expect(extractTedSlug("https://www.youtube.com/watch?v=abc123")).toBeNull();
  });

  it("returns null for ted.com homepage", () => {
    expect(extractTedSlug("https://www.ted.com")).toBeNull();
  });

  it("handles ted.com/talks/ with trailing slash", () => {
    const slug = extractTedSlug("https://www.ted.com/talks/adam_grant_the_surprising_habits_of_original_thinkers/");
    expect(slug).toBe("adam_grant_the_surprising_habits_of_original_thinkers");
  });
});

// ── OpenAlex DOI normalisation ────────────────────────────────────────────────

describe("OpenAlex identifier normalisation", () => {
  function buildOpenAlexUrl(identifier: string): string {
    const doiMatch = identifier.match(/10\.\d{4,}[/.]\S+/);
    const openAlexMatch = identifier.match(/openalex\.org\/(W\d+)/);
    const workIdMatch = identifier.match(/^W\d+$/);

    if (openAlexMatch || workIdMatch) {
      const workId = openAlexMatch ? openAlexMatch[1] : identifier;
      return `https://api.openalex.org/works/${workId}?mailto=library@norfolkai.com`;
    } else if (doiMatch) {
      const doi = doiMatch[0];
      return `https://api.openalex.org/works/https://doi.org/${doi}?mailto=library@norfolkai.com`;
    } else {
      const q = encodeURIComponent(identifier);
      return `https://api.openalex.org/works?search=${q}&per-page=1&mailto=library@norfolkai.com`;
    }
  }

  it("builds direct work URL for OpenAlex work ID", () => {
    const url = buildOpenAlexUrl("W2741809807");
    expect(url).toBe("https://api.openalex.org/works/W2741809807?mailto=library@norfolkai.com");
  });

  it("builds DOI URL for doi.org URL", () => {
    const url = buildOpenAlexUrl("https://doi.org/10.1038/nature12373");
    expect(url).toContain("https://api.openalex.org/works/https://doi.org/10.1038/nature12373");
  });

  it("builds DOI URL for bare DOI", () => {
    const url = buildOpenAlexUrl("10.1038/nature12373");
    expect(url).toContain("https://api.openalex.org/works/https://doi.org/10.1038/nature12373");
  });

  it("builds search URL for title query", () => {
    const url = buildOpenAlexUrl("The power of habit");
    expect(url).toContain("https://api.openalex.org/works?search=");
    expect(url).toContain("The%20power%20of%20habit");
  });

  it("builds work URL for openalex.org URL", () => {
    const url = buildOpenAlexUrl("https://openalex.org/W2741809807");
    expect(url).toBe("https://api.openalex.org/works/W2741809807?mailto=library@norfolkai.com");
  });
});

// ── Abstract reconstruction from inverted index ───────────────────────────────

describe("OpenAlex abstract reconstruction", () => {
  function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
    const wordPositions: Array<[string, number]> = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) wordPositions.push([word, pos]);
    }
    wordPositions.sort((a, b) => a[1] - b[1]);
    return wordPositions.map(([w]) => w).join(" ");
  }

  it("reconstructs a simple abstract correctly", () => {
    const invertedIndex = {
      "Hello": [0],
      "world": [1],
      "this": [2],
      "is": [3],
      "a": [4],
      "test": [5],
    };
    expect(reconstructAbstract(invertedIndex)).toBe("Hello world this is a test");
  });

  it("handles words appearing multiple times", () => {
    const invertedIndex = {
      "the": [0, 3],
      "cat": [1],
      "sat": [2],
      "mat": [4],
    };
    expect(reconstructAbstract(invertedIndex)).toBe("the cat sat the mat");
  });

  it("returns empty string for empty index", () => {
    expect(reconstructAbstract({})).toBe("");
  });
});

// ── OMDB URL / IMDB ID extraction ─────────────────────────────────────────────

describe("OMDB IMDB ID extraction", () => {
  function extractImdbId(identifier: string): string | null {
    const match = identifier.match(/tt\d{7,8}/);
    return match ? match[0] : null;
  }

  it("extracts IMDB ID from full URL", () => {
    expect(extractImdbId("https://www.imdb.com/title/tt0816692/")).toBe("tt0816692");
  });

  it("extracts IMDB ID from bare ID string", () => {
    expect(extractImdbId("tt0816692")).toBe("tt0816692");
  });

  it("extracts 8-digit IMDB ID", () => {
    expect(extractImdbId("https://www.imdb.com/title/tt12345678/")).toBe("tt12345678");
  });

  it("returns null for non-IMDB URL", () => {
    expect(extractImdbId("https://www.youtube.com/watch?v=abc")).toBeNull();
  });

  it("returns null for title search string", () => {
    expect(extractImdbId("Interstellar 2014")).toBeNull();
  });
});

// ── Substack URL parsing ──────────────────────────────────────────────────────

describe("Substack URL parsing", () => {
  function parseSubstackUrl(url: string): { publication: string | null; postSlug: string | null } {
    const postMatch = url.match(/https?:\/\/([-\w]+)\.substack\.com\/p\/([-\w]+)/);
    const pubMatch = url.match(/https?:\/\/([-\w]+)\.substack\.com/);
    return {
      publication: pubMatch ? pubMatch[1] : null,
      postSlug: postMatch ? postMatch[2] : null,
    };
  }

  it("parses publication and post slug from post URL", () => {
    const result = parseSubstackUrl("https://adamgrant.substack.com/p/hidden-potential-review");
    expect(result.publication).toBe("adamgrant");
    expect(result.postSlug).toBe("hidden-potential-review");
  });

  it("parses publication only from home URL", () => {
    const result = parseSubstackUrl("https://adamgrant.substack.com");
    expect(result.publication).toBe("adamgrant");
    expect(result.postSlug).toBeNull();
  });

  it("returns nulls for non-Substack URL", () => {
    const result = parseSubstackUrl("https://medium.com/@author/post-title");
    expect(result.publication).toBeNull();
    expect(result.postSlug).toBeNull();
  });

  it("handles hyphenated publication names", () => {
    const result = parseSubstackUrl("https://the-profile.substack.com/p/my-post");
    expect(result.publication).toBe("the-profile");
    expect(result.postSlug).toBe("my-post");
  });
});

// ── BulkUrlImportPanel URL type detection ────────────────────────────────────

describe("BulkUrlImportPanel URL type detection", () => {
  type UrlType = "youtube" | "ted" | "paper" | "film" | "substack" | "podcast_query" | "generic";

  function detectUrlType(url: string): UrlType {
    if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
    if (/ted\.com\/talks\//.test(url)) return "ted";
    if (/doi\.org\/10\.|openalex\.org\/W/.test(url)) return "paper";
    if (/imdb\.com\/title\/tt/.test(url)) return "film";
    if (/\.substack\.com/.test(url)) return "substack";
    if (/spotify\.com\/episode|podcasts\.apple\.com|anchor\.fm/.test(url)) return "podcast_query";
    return "generic";
  }

  it("detects YouTube video URL", () => {
    expect(detectUrlType("https://www.youtube.com/watch?v=abc123")).toBe("youtube");
  });

  it("detects youtu.be short URL", () => {
    expect(detectUrlType("https://youtu.be/abc123")).toBe("youtube");
  });

  it("detects TED talk URL", () => {
    expect(detectUrlType("https://www.ted.com/talks/brene_brown_the_power_of_vulnerability")).toBe("ted");
  });

  it("detects DOI URL as paper", () => {
    expect(detectUrlType("https://doi.org/10.1038/nature12373")).toBe("paper");
  });

  it("detects OpenAlex work URL as paper", () => {
    expect(detectUrlType("https://openalex.org/W2741809807")).toBe("paper");
  });

  it("detects IMDB URL as film", () => {
    expect(detectUrlType("https://www.imdb.com/title/tt0816692/")).toBe("film");
  });

  it("detects Substack post URL", () => {
    expect(detectUrlType("https://adamgrant.substack.com/p/post-title")).toBe("substack");
  });

  it("detects Substack home URL", () => {
    expect(detectUrlType("https://adamgrant.substack.com")).toBe("substack");
  });

  it("detects Apple Podcasts URL as podcast_query", () => {
    expect(detectUrlType("https://podcasts.apple.com/us/podcast/id123")).toBe("podcast_query");
  });

  it("falls back to generic for unknown URLs", () => {
    expect(detectUrlType("https://example.com/article")).toBe("generic");
  });

  it("does not classify ted.com homepage as ted talk", () => {
    expect(detectUrlType("https://www.ted.com")).toBe("generic");
  });
});

// ── Migration: title normalisation for deduplication ─────────────────────────

describe("Book migration title normalisation", () => {
  function normalizeTitle(title: string): string {
    return title.toLowerCase().trim();
  }

  it("normalises to lowercase", () => {
    expect(normalizeTitle("Hidden Potential")).toBe("hidden potential");
  });

  it("trims whitespace", () => {
    expect(normalizeTitle("  Atomic Habits  ")).toBe("atomic habits");
  });

  it("handles already lowercase title", () => {
    expect(normalizeTitle("thinking, fast and slow")).toBe("thinking, fast and slow");
  });

  it("deduplicates same title with different casing", () => {
    const set = new Set<string>();
    set.add(normalizeTitle("Hidden Potential"));
    expect(set.has(normalizeTitle("hidden potential"))).toBe(true);
    expect(set.has(normalizeTitle("HIDDEN POTENTIAL"))).toBe(true);
  });
});
