/**
 * webSearch.test.ts — unit tests for the Exa + Perplexity web research helpers.
 *
 * Covers graceful failure (missing key, network error, non-200) and the
 * happy-path response shape via a mocked fetch. No live calls.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { exaSearch, perplexityAnswer, webResearch } from "./enrichment/webSearch";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── exaSearch ────────────────────────────────────────────────────────────────

describe("exaSearch", () => {
  it("returns [] when no API key is provided", async () => {
    const result = await exaSearch("deep work", 5, "");
    expect(result).toEqual([]);
  });

  it("returns [] for an empty query", async () => {
    const result = await exaSearch("   ", 5, "fake-key");
    expect(result).toEqual([]);
  });

  it("returns [] on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await exaSearch("deep work", 5, "fake-key");
    expect(result).toEqual([]);
  });

  it("returns [] on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);
    const result = await exaSearch("deep work", 5, "fake-key");
    expect(result).toEqual([]);
  });

  it("maps results to ExaResult shape on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: "Deep Work",
            url: "https://example.com/deep-work",
            text: "  A book about   focused success  ",
            publishedDate: "2024-01-01",
            author: "Cal Newport",
            score: 0.91,
          },
          { title: "No URL", url: "", text: "dropped" },
        ],
      }),
    } as Response);
    const result = await exaSearch("deep work", 5, "fake-key");
    expect(result).toHaveLength(1); // entry without a URL is filtered out
    expect(result[0]).toMatchObject({
      title: "Deep Work",
      url: "https://example.com/deep-work",
      snippet: "A book about focused success",
      author: "Cal Newport",
    });
  });
});

// ─── perplexityAnswer ───────────────────────────────────────────────────────

describe("perplexityAnswer", () => {
  it("returns null when no API key is provided", async () => {
    const result = await perplexityAnswer("what is deep work", "");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await perplexityAnswer("what is deep work", "fake-key");
    expect(result).toBeNull();
  });

  it("returns answer + citations on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Deep work is focused, distraction-free work." } }],
        citations: ["https://example.com/a", "https://example.com/b"],
      }),
    } as Response);
    const result = await perplexityAnswer("what is deep work", "fake-key");
    expect(result).not.toBeNull();
    expect(result!.answer).toContain("Deep work");
    expect(result!.citations).toHaveLength(2);
  });

  it("returns empty citations array when none provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "An answer." } }] }),
    } as Response);
    const result = await perplexityAnswer("q", "fake-key");
    expect(result!.citations).toEqual([]);
  });
});

// ─── webResearch ──────────────────────────────────────────────────────────────

describe("webResearch", () => {
  it("returns a well-formed result shape with no keys configured", async () => {
    // No EXA_API_KEY / PERPLEXITY_API_KEY in the test env → graceful empty result.
    const result = await webResearch("anything");
    expect(result.query).toBe("anything");
    expect(Array.isArray(result.sources)).toBe(true);
    expect(Array.isArray(result.citations)).toBe(true);
    expect(result).toHaveProperty("answer");
  });
});
