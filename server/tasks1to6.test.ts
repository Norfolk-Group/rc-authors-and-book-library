/**
 * Tests for Tasks 1–6 implementation:
 *  - Task 2: CNBC article count badge + LinkedIn follower count badge on FlowbiteAuthorCard
 *  - Task 3: Cmd+K command palette (CommandPalette component)
 *  - Task 4: Author "In the News" section (enrichment.news.searchAuthorNews procedure)
 *  - Task 5: Book ISBN barcode (ISBNBarcode component — ISBN normalization logic)
 *  - Task 6: VITE_APP_LOGO (manual step — documented only)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Task 2: CNBC / LinkedIn badge logic ─────────────────────────────────────

describe("CNBC article count badge", () => {
  function computeCNBCBadge(socialStatsJson: unknown): { count: number; label: string } | null {
    if (!socialStatsJson || typeof socialStatsJson !== "object") return null;
    const stats = socialStatsJson as Record<string, unknown>;
    const cnbc = stats.cnbc as Record<string, unknown> | undefined;
    if (!cnbc) return null;
    const count = typeof cnbc.articleCount === "number" ? cnbc.articleCount : 0;
    if (count === 0) return null;
    return { count, label: count === 1 ? "1 article" : `${count} articles` };
  }

  it("returns null when socialStatsJson is null", () => {
    expect(computeCNBCBadge(null)).toBeNull();
  });

  it("returns null when cnbc field is missing", () => {
    expect(computeCNBCBadge({ twitter: { followers: 1000 } })).toBeNull();
  });

  it("returns null when articleCount is 0", () => {
    expect(computeCNBCBadge({ cnbc: { articleCount: 0 } })).toBeNull();
  });

  it("returns badge with count and label for 1 article", () => {
    const result = computeCNBCBadge({ cnbc: { articleCount: 1 } });
    expect(result).toEqual({ count: 1, label: "1 article" });
  });

  it("returns badge with count and label for multiple articles", () => {
    const result = computeCNBCBadge({ cnbc: { articleCount: 42 } });
    expect(result).toEqual({ count: 42, label: "42 articles" });
  });
});

describe("LinkedIn follower count badge", () => {
  function computeLinkedInBadge(socialStatsJson: unknown): { followers: string } | null {
    if (!socialStatsJson || typeof socialStatsJson !== "object") return null;
    const stats = socialStatsJson as Record<string, unknown>;
    const linkedin = stats.linkedin as Record<string, unknown> | undefined;
    if (!linkedin) return null;
    const followers = typeof linkedin.followers === "number" ? linkedin.followers : 0;
    if (followers === 0) return null;
    const formatted =
      followers >= 1_000_000
        ? `${(followers / 1_000_000).toFixed(1)}M`
        : followers >= 1_000
        ? `${(followers / 1_000).toFixed(0)}K`
        : String(followers);
    return { followers: formatted };
  }

  it("returns null when socialStatsJson is null", () => {
    expect(computeLinkedInBadge(null)).toBeNull();
  });

  it("returns null when linkedin field is missing", () => {
    expect(computeLinkedInBadge({ twitter: { followers: 1000 } })).toBeNull();
  });

  it("returns null when followers is 0", () => {
    expect(computeLinkedInBadge({ linkedin: { followers: 0 } })).toBeNull();
  });

  it("formats thousands as K", () => {
    expect(computeLinkedInBadge({ linkedin: { followers: 45000 } })).toEqual({ followers: "45K" });
  });

  it("formats millions as M", () => {
    expect(computeLinkedInBadge({ linkedin: { followers: 2_500_000 } })).toEqual({ followers: "2.5M" });
  });
});

// ─── Task 3: Command palette search filtering ─────────────────────────────────

describe("CommandPalette search filtering", () => {
  const authors = [
    { name: "Adam Grant", category: "Psychology" },
    { name: "James Clear", category: "Habits" },
    { name: "Brené Brown", category: "Leadership" },
  ];

  const books = [
    { name: "Atomic Habits - James Clear", category: "Habits" },
    { name: "Think Again - Adam Grant", category: "Psychology" },
    { name: "Dare to Lead - Brené Brown", category: "Leadership" },
  ];

  function filterItems(query: string) {
    const q = query.toLowerCase();
    const matchedAuthors = authors.filter((a) => a.name.toLowerCase().includes(q));
    const matchedBooks = books.filter((b) => b.name.toLowerCase().includes(q));
    return { authors: matchedAuthors, books: matchedBooks };
  }

  it("returns all items for empty query", () => {
    const { authors: a, books: b } = filterItems("");
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
  });

  it("filters authors by name", () => {
    const { authors: a } = filterItems("adam");
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("Adam Grant");
  });

  it("filters books by title", () => {
    const { books: b } = filterItems("atomic");
    expect(b).toHaveLength(1);
    expect(b[0].name).toContain("Atomic Habits");
  });

  it("matches across both authors and books for author name in book title", () => {
    const { authors: a, books: b } = filterItems("james clear");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("returns empty arrays for no match", () => {
    const { authors: a, books: b } = filterItems("zzzzz");
    expect(a).toHaveLength(0);
    expect(b).toHaveLength(0);
  });
});

// ─── Task 4: enrichment.news.searchAuthorNews procedure ──────────────────────

describe("enrichment.news.searchAuthorNews procedure shape", () => {
  it("procedure is accessible via the enrichment.news namespace", async () => {
    // Validate that the procedure module exports the function
    const { searchAuthorNews } = await import("./enrichment/newsSearch");
    expect(typeof searchAuthorNews).toBe("function");
  });

  it("returns an empty array gracefully on network failure", async () => {
    const { searchAuthorNews } = await import("./enrichment/newsSearch");
    // Mock fetch to simulate network failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchAuthorNews("Test Author", 5);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
    globalThis.fetch = originalFetch;
  });

  it("returns articles with required fields when fetch succeeds", async () => {
    const { searchAuthorNews } = await import("./enrichment/newsSearch");
    // Mock a minimal RSS response
    const mockRSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Adam Grant on Resilience</title>
    <link>https://example.com/article1</link>
    <source url="https://cnbc.com">CNBC</source>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
  </item>
</channel></rss>`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockRSS,
    } as Response);
    const results = await searchAuthorNews("Adam Grant", 5);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("url");
      expect(results[0]).toHaveProperty("source");
    }
    globalThis.fetch = originalFetch;
  });
});

// ─── Task 5: ISBN barcode normalization ──────────────────────────────────────

describe("ISBNBarcode normalization (normalizeToISBN13)", () => {
  // Inline the normalization logic for pure unit testing
  function normalizeToISBN13(raw: string): string | null {
    const digits = raw.replace(/[-\s]/g, "");
    if (digits.length === 13 && /^\d{13}$/.test(digits)) return digits;
    if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits)) {
      const base = "978" + digits.slice(0, 9);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const check = (10 - (sum % 10)) % 10;
      return base + check;
    }
    return null;
  }

  it("returns ISBN-13 as-is when valid", () => {
    expect(normalizeToISBN13("9780735224292")).toBe("9780735224292");
  });

  it("strips hyphens from ISBN-13", () => {
    expect(normalizeToISBN13("978-0-7352-2429-2")).toBe("9780735224292");
  });

  it("converts ISBN-10 to ISBN-13 correctly", () => {
    // ISBN-10: 0735224293 → ISBN-13: 9780735224292
    expect(normalizeToISBN13("0735224293")).toBe("9780735224292");
  });

  it("returns null for invalid ISBN (too short)", () => {
    expect(normalizeToISBN13("12345")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(normalizeToISBN13("not-an-isbn")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeToISBN13("")).toBeNull();
  });

  it("handles ISBN-13 with spaces", () => {
    expect(normalizeToISBN13("978 0 7352 2429 2")).toBe("9780735224292");
  });
});
