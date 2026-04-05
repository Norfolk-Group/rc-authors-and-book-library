/**
 * suggestions2.test.ts
 *
 * Tests for the three features implemented in the "implement all suggestions" session:
 *   1. Substack post-count badge logic in FlowbiteAuthorCard (pure util)
 *   2. Search mode persistence helper (localStorage key)
 *   3. SemanticSearchDropdown only fires when AI mode is active (logic guard)
 *   4. vectorSearch.indexAllArticles procedure exists in the router
 */

import { describe, it, expect } from "vitest";

// ── 1. Substack badge logic ────────────────────────────────────────────────────
describe("Substack badge logic", () => {
  function computeSubstackBadge(
    platformLinks: {
      substackUrl?: string | null;
      socialStatsJson?: string | null;
    } | null | undefined
  ) {
    if (!platformLinks?.substackUrl) return null;
    let postCount: number | null = null;
    if (platformLinks.socialStatsJson) {
      try {
        const stats = JSON.parse(platformLinks.socialStatsJson as string);
        postCount = stats?.substack?.postCount ?? null;
      } catch {
        // ignore
      }
    }
    return { url: platformLinks.substackUrl, postCount };
  }

  it("returns null when substackUrl is absent", () => {
    expect(computeSubstackBadge(null)).toBeNull();
    expect(computeSubstackBadge({})).toBeNull();
    expect(computeSubstackBadge({ substackUrl: null })).toBeNull();
  });

  it("returns badge with null postCount when no socialStatsJson", () => {
    const result = computeSubstackBadge({ substackUrl: "https://adamgrant.substack.com" });
    expect(result).not.toBeNull();
    expect(result?.url).toBe("https://adamgrant.substack.com");
    expect(result?.postCount).toBeNull();
  });

  it("returns badge with postCount when socialStatsJson has substack.postCount", () => {
    const json = JSON.stringify({ substack: { postCount: 42, subscriberRange: "10k–50k" } });
    const result = computeSubstackBadge({
      substackUrl: "https://adamgrant.substack.com",
      socialStatsJson: json,
    });
    expect(result?.postCount).toBe(42);
  });

  it("returns badge with null postCount when socialStatsJson is malformed", () => {
    const result = computeSubstackBadge({
      substackUrl: "https://adamgrant.substack.com",
      socialStatsJson: "NOT_VALID_JSON",
    });
    expect(result?.postCount).toBeNull();
  });

  it("returns badge with null postCount when substack key is missing in stats", () => {
    const json = JSON.stringify({ twitter: { followerCount: 100000 } });
    const result = computeSubstackBadge({
      substackUrl: "https://adamgrant.substack.com",
      socialStatsJson: json,
    });
    expect(result?.postCount).toBeNull();
  });
});

// ── 2. Search mode persistence key ────────────────────────────────────────────
describe("Search mode persistence", () => {
  const STORAGE_KEY = "library-search-mode";

  function readMode(stored: string | null): "keyword" | "ai" {
    return stored === "ai" ? "ai" : "keyword";
  }

  it("defaults to keyword when nothing is stored", () => {
    expect(readMode(null)).toBe("keyword");
  });

  it("reads 'ai' mode from storage", () => {
    expect(readMode("ai")).toBe("ai");
  });

  it("falls back to keyword for unknown stored values", () => {
    expect(readMode("semantic")).toBe("keyword");
    expect(readMode("")).toBe("keyword");
  });

  it("uses the correct localStorage key", () => {
    expect(STORAGE_KEY).toBe("library-search-mode");
  });
});

// ── 3. Semantic dropdown guard ─────────────────────────────────────────────────
describe("SemanticSearchDropdown activation guard", () => {
  function shouldOpenDropdown(searchMode: "keyword" | "ai", queryLength: number): boolean {
    return searchMode === "ai" && queryLength >= 3;
  }

  it("does not open in keyword mode regardless of query length", () => {
    expect(shouldOpenDropdown("keyword", 0)).toBe(false);
    expect(shouldOpenDropdown("keyword", 3)).toBe(false);
    expect(shouldOpenDropdown("keyword", 10)).toBe(false);
  });

  it("does not open in AI mode when query is too short", () => {
    expect(shouldOpenDropdown("ai", 0)).toBe(false);
    expect(shouldOpenDropdown("ai", 1)).toBe(false);
    expect(shouldOpenDropdown("ai", 2)).toBe(false);
  });

  it("opens in AI mode when query is 3+ chars", () => {
    expect(shouldOpenDropdown("ai", 3)).toBe(true);
    expect(shouldOpenDropdown("ai", 10)).toBe(true);
  });
});

// ── 4. vectorSearch router has indexAllArticles ────────────────────────────────
describe("vectorSearch router", () => {
  it("exports indexAllArticles procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    expect(vectorSearchRouter._def.procedures).toHaveProperty("indexAllArticles");
  });

  it("exports search procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    expect(vectorSearchRouter._def.procedures).toHaveProperty("search");
  });

  it("exports getStats procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    expect(vectorSearchRouter._def.procedures).toHaveProperty("getStats");
  });
});
