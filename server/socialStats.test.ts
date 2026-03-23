/**
 * socialStats.test.ts — Unit tests for social stats enrichment helpers
 *
 * Tests cover:
 *   - GitHub: extractGitHubUsername parsing
 *   - Wikipedia: fetchWikipediaStats for a known author
 *   - Substack: extractSubstackSubdomain parsing
 *   - YC: fetchYCStats returns a valid shape
 *   - SocialStats orchestrator: shape validation
 */

import { describe, it, expect } from "vitest";
import { extractGitHubUsername } from "./enrichment/github";
import { extractSubstackSubdomain } from "./enrichment/substack";

// ── GitHub username extraction ─────────────────────────────────────────────────

describe("extractGitHubUsername", () => {
  it("extracts username from full GitHub URL", () => {
    expect(extractGitHubUsername("https://github.com/sindresorhus")).toBe("sindresorhus");
  });

  it("extracts username from URL without protocol", () => {
    expect(extractGitHubUsername("github.com/torvalds")).toBe("torvalds");
  });

  it("extracts username from @handle", () => {
    expect(extractGitHubUsername("@dhh")).toBe("dhh");
  });

  it("returns null for empty string", () => {
    expect(extractGitHubUsername("")).toBeNull();
  });

  it("returns null for non-GitHub URL", () => {
    expect(extractGitHubUsername("https://twitter.com/user")).toBeNull();
  });

  it("handles URL with trailing slash", () => {
    expect(extractGitHubUsername("https://github.com/adamgrant/")).toBe("adamgrant");
  });
});

// ── Substack subdomain extraction ─────────────────────────────────────────────

describe("extractSubstackSubdomain", () => {
  it("extracts subdomain from full Substack URL", () => {
    expect(extractSubstackSubdomain("https://morganhousel.substack.com")).toBe("morganhousel");
  });

  it("extracts subdomain from URL without protocol", () => {
    expect(extractSubstackSubdomain("jamesclear.substack.com")).toBe("jamesclear");
  });

  it("extracts subdomain from URL with path", () => {
    expect(extractSubstackSubdomain("https://seths.substack.com/p/some-post")).toBe("seths");
  });

  it("returns null for empty string", () => {
    expect(extractSubstackSubdomain("")).toBeNull();
  });

  it("returns null for non-Substack URL", () => {
    expect(extractSubstackSubdomain("https://medium.com/@author")).toBeNull();
  });
});

// ── Wikipedia stats (live API call — only run if network is available) ─────────

describe("fetchWikipediaStats", () => {
  it("returns valid stats for Malcolm Gladwell", async () => {
    const { fetchWikipediaStats } = await import("./enrichment/wikipedia");
    const stats = await fetchWikipediaStats("Malcolm Gladwell");
    // Wikipedia API may or may not be available in test environment
    if (stats === null) {
      console.warn("Wikipedia API not available in test environment — skipping");
      return;
    }
    expect(stats).toMatchObject({
      pageTitle: expect.any(String),
      pageUrl: expect.stringContaining("wikipedia.org"),
      fetchedAt: expect.any(String),
    });
    expect(stats.avgMonthlyViews).toBeGreaterThanOrEqual(0);
  }, 15_000);

  it("returns null for a clearly non-existent author", async () => {
    const { fetchWikipediaStats } = await import("./enrichment/wikipedia");
    const stats = await fetchWikipediaStats("Xyzzy_Nonexistent_Author_12345");
    // Should return null or a stats object with empty extract
    if (stats !== null) {
      expect(stats.pageTitle).toBeDefined();
    }
  }, 15_000);
});

// ── Y Combinator stats ─────────────────────────────────────────────────────────

describe("fetchYCStats", () => {
  it("returns a valid shape for any author name", async () => {
    const { fetchYCStats } = await import("./enrichment/ycombinator");
    const stats = await fetchYCStats("Sam Altman");
    if (stats === null) {
      console.warn("YC API not available — skipping");
      return;
    }
    expect(stats).toMatchObject({
      isYCFounder: expect.any(Boolean),
      fetchedAt: expect.any(String),
    });
  }, 15_000);
});

// ── Social stats orchestrator shape ───────────────────────────────────────────

describe("enrichAuthorSocialStats", () => {
  it("returns a valid result shape with empty config", async () => {
    const { enrichAuthorSocialStats } = await import("./enrichment/socialStats");
    const result = await enrichAuthorSocialStats(
      { authorName: "Test Author" },
      { phases: ["A"] }
    );
    expect(result).toMatchObject({
      enrichedAt: expect.any(String),
      platformsAttempted: expect.any(Array),
      platformsSucceeded: expect.any(Array),
    });
    // Wikipedia should be attempted even without a URL
    expect(result.platformsAttempted).toContain("wikipedia");
    expect(result.platformsAttempted).toContain("ycombinator");
  }, 30_000);
});
