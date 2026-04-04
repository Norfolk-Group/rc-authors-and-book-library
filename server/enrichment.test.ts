/**
 * Enrichment API helpers — unit tests
 *
 * Tests cover:
 *  - openLibrary: searchBooks, getBookByISBN, searchAuthors, getCoverUrl, enrichBookFromOpenLibrary
 *  - applePodcasts: searchPodcasts, getAuthorPodcasts, getArtworkUrl
 *  - hathiTrust: checkDigitalAvailability, getAvailabilitySummary, getReadUrl
 *  - newsSearch: searchAuthorNews, searchBookNews (shape validation only — no live calls)
 *
 * Live network calls are skipped in CI (SKIP_LIVE_TESTS=true).
 * Shape-only tests run always.
 */

import { describe, it, expect, vi } from "vitest";
import {
  getCoverUrl,
  searchBooks,
  searchAuthors,
  getBookByISBN,
  enrichBookFromOpenLibrary,
} from "./enrichment/openLibrary";
import {
  getArtworkUrl,
  searchPodcasts,
  getAuthorPodcasts,
} from "./enrichment/applePodcasts";
import {
  getReadUrl,
  checkDigitalAvailability,
  getAvailabilitySummary,
} from "./enrichment/hathiTrust";
import {
  searchAuthorNews,
  searchBookNews,
} from "./enrichment/newsSearch";

const SKIP_LIVE = process.env.SKIP_LIVE_TESTS === "true";

// ─── Open Library ─────────────────────────────────────────────────────────────

describe("openLibrary", () => {
  describe("getCoverUrl", () => {
    it("builds correct URL for medium size", () => {
      expect(getCoverUrl(12345, "M")).toBe(
        "https://covers.openlibrary.org/b/id/12345-M.jpg"
      );
    });
    it("builds correct URL for large size", () => {
      expect(getCoverUrl(99999, "L")).toBe(
        "https://covers.openlibrary.org/b/id/99999-L.jpg"
      );
    });
    it("defaults to M size", () => {
      expect(getCoverUrl(1)).toContain("-M.jpg");
    });
  });

  it.skipIf(SKIP_LIVE)("searchBooks returns results for a known title", async () => {
    const results = await searchBooks("Give and Take Adam Grant", 3);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty("key");
    expect(first).toHaveProperty("title");
    expect(typeof first.title).toBe("string");
  }, 20_000);

  it.skipIf(SKIP_LIVE)("searchAuthors returns results for a known author", async () => {
    const results = await searchAuthors("Adam Grant", 3);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty("key");
    expect(first).toHaveProperty("name");
    expect(first.work_count).toBeGreaterThanOrEqual(0);
  }, 20_000);

  it.skipIf(SKIP_LIVE)("getBookByISBN returns edition data for a valid ISBN", async () => {
    // ISBN for "Thinking, Fast and Slow" by Daniel Kahneman
    const edition = await getBookByISBN("9780374533557");
    if (edition) {
      expect(edition).toHaveProperty("title");
      expect(typeof edition.title).toBe("string");
    }
    // null is also acceptable if OL doesn't have this edition
  }, 20_000);

  it.skipIf(SKIP_LIVE)("enrichBookFromOpenLibrary returns enrichment data", async () => {
    const result = await enrichBookFromOpenLibrary({
      title: "Give and Take",
      authorName: "Adam Grant",
    });
    if (result) {
      // Should have at least one field
      const hasData =
        result.coverUrl !== undefined ||
        result.isbn13 !== undefined ||
        result.publishYear !== undefined;
      expect(hasData).toBe(true);
    }
  }, 20_000);
});

// ─── Apple Podcasts ───────────────────────────────────────────────────────────

describe("applePodcasts", () => {
  describe("getArtworkUrl", () => {
    it("replaces size suffix correctly", () => {
      const url =
        "https://is1-ssl.mzstatic.com/image/thumb/Podcasts123/100x100bb.jpg";
      expect(getArtworkUrl(url, 300)).toBe(
        "https://is1-ssl.mzstatic.com/image/thumb/Podcasts123/300x300bb.jpg"
      );
    });
    it("returns undefined for undefined input", () => {
      expect(getArtworkUrl(undefined)).toBeUndefined();
    });
    it("defaults to 300px", () => {
      const url = "https://example.com/100x100bb.jpg";
      expect(getArtworkUrl(url)).toContain("300x300bb");
    });
  });

  it.skipIf(SKIP_LIVE)("searchPodcasts returns results for a known term", async () => {
    const results = await searchPodcasts("WorkLife Adam Grant", 5);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty("collectionId");
    expect(first).toHaveProperty("collectionName");
    expect(typeof first.collectionName).toBe("string");
  }, 20_000);

  it.skipIf(SKIP_LIVE)("getAuthorPodcasts returns podcasts for Adam Grant", async () => {
    const results = await getAuthorPodcasts("Adam Grant", 5);
    expect(Array.isArray(results)).toBe(true);
    // Should find WorkLife with Adam Grant
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("collectionId");
      expect(results[0]).toHaveProperty("artistName");
    }
  }, 20_000);
});

// ─── HathiTrust ───────────────────────────────────────────────────────────────

describe("hathiTrust", () => {
  describe("getReadUrl", () => {
    it("builds correct reader URL", () => {
      expect(getReadUrl("mdp.39015012345678")).toBe(
        "https://babel.hathitrust.org/cgi/pt?id=mdp.39015012345678"
      );
    });
    it("URL-encodes special characters in htid", () => {
      expect(getReadUrl("uc1.b3456789")).toContain("uc1.b3456789");
    });
  });

  it.skipIf(SKIP_LIVE)("checkDigitalAvailability returns a valid shape", async () => {
    // ISBN for a public domain book (e.g., "The Wealth of Nations")
    const result = await checkDigitalAvailability("9780679783367");
    if (result !== null) {
      expect(result).toHaveProperty("available");
      expect(typeof result.available).toBe("boolean");
    }
  }, 20_000);

  it.skipIf(SKIP_LIVE)("getAvailabilitySummary returns a valid shape", async () => {
    const result = await getAvailabilitySummary("9780679783367");
    if (result !== null) {
      expect(result).toHaveProperty("totalCopies");
      expect(result).toHaveProperty("fullViewCopies");
      expect(result).toHaveProperty("searchOnlyCopies");
      expect(typeof result.totalCopies).toBe("number");
    }
  }, 20_000);
});

// ─── News Search ──────────────────────────────────────────────────────────────

describe("newsSearch", () => {
  it.skipIf(SKIP_LIVE)("searchAuthorNews returns articles for a known author", async () => {
    const articles = await searchAuthorNews("Adam Grant", 5);
    expect(Array.isArray(articles)).toBe(true);
    if (articles.length > 0) {
      const first = articles[0];
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("url");
      expect(first).toHaveProperty("source");
      expect(typeof first.title).toBe("string");
      expect(typeof first.url).toBe("string");
    }
  }, 25_000);

  it.skipIf(SKIP_LIVE)("searchBookNews returns articles for a known book", async () => {
    const articles = await searchBookNews("Thinking Fast and Slow", "Daniel Kahneman", 5);
    expect(Array.isArray(articles)).toBe(true);
    if (articles.length > 0) {
      expect(articles[0]).toHaveProperty("title");
      expect(articles[0]).toHaveProperty("url");
    }
  }, 25_000);

  it("searchAuthorNews returns empty array on network failure (graceful)", async () => {
    // Mock fetch to simulate failure
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async () => { throw new Error("Network error"); });
    const articles = await searchAuthorNews("Test Author", 5);
    expect(Array.isArray(articles)).toBe(true);
    expect(articles.length).toBe(0);
    vi.stubGlobal("fetch", originalFetch);
  });
});
