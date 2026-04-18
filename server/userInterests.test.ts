/**
 * userInterests.test.ts
 *
 * Tests for the P2 Neon-first pre-filter optimization in scoreAllAuthors.
 *
 * Strategy: mock embedText and queryVectors so tests run without real API calls.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock Neon vector and Gemini services ─────────────────────────────────────────

vi.mock("./services/ragPipeline.service", () => ({
  embedText: vi.fn().mockResolvedValue(new Array(3072).fill(0.1)),
}));

vi.mock("./services/neonVector.service", () => ({
  queryVectors: vi.fn().mockResolvedValue([
    { id: "author-adam-grant-chunk0", score: 0.92, metadata: { authorName: "Adam Grant", contentType: "author", text: "..." } },
    { id: "author-daniel-kahneman-chunk0", score: 0.88, metadata: { authorName: "Daniel Kahneman", contentType: "author", text: "..." } },
    { id: "author-adam-grant-chunk1", score: 0.85, metadata: { authorName: "Adam Grant", contentType: "author", text: "..." } }, // duplicate author
    { id: "author-nassim-taleb-chunk0", score: 0.81, metadata: { authorName: "Nassim Taleb", contentType: "author", text: "..." } },
  ]),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { embedText } from "./services/ragPipeline.service";
import { queryVectors } from "./services/neonVector.service";

// ── Inline the getNeonAuthorCandidates logic for unit testing ─────────────
// We test the logic directly since it's a module-level private function.
// In production it's called by scoreAllAuthors.

async function getNeonAuthorCandidates(
  interests: Array<{ topic: string; description: string | null; weight: string }>,
  topK = 30
): Promise<string[]> {
  try {
    const weightMultiplier: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const queryParts: string[] = [];
    for (const interest of interests) {
      const repeat = weightMultiplier[interest.weight] ?? 2;
      const phrase = interest.description
        ? `${interest.topic}: ${interest.description}`
        : interest.topic;
      for (let i = 0; i < repeat; i++) queryParts.push(phrase);
    }
    const queryText = queryParts.join(". ");

    const queryEmbedding = await embedText(queryText);
    const hits = await queryVectors(queryEmbedding, "authors", { topK });

    const seen = new Set<string>();
    const candidates: string[] = [];
    for (const hit of hits) {
      const name = (hit as { metadata?: { authorName?: string } }).metadata?.authorName;
      if (name && !seen.has(name)) {
        seen.add(name);
        candidates.push(name);
      }
    }
    return candidates;
  } catch {
    return [];
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getNeonAuthorCandidates (P2 pre-filter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unique author names from Neon vector hits (deduplicates chunks)", async () => {
    const interests = [
      { topic: "Behavioral Economics", description: "decision-making biases", weight: "high" },
      { topic: "Organizational Psychology", description: null, weight: "medium" },
    ];

    const candidates = await getNeonAuthorCandidates(interests, 10);

    // Should return 3 unique authors (Adam Grant appears twice in hits but deduped)
    expect(candidates).toHaveLength(3);
    expect(candidates).toContain("Adam Grant");
    expect(candidates).toContain("Daniel Kahneman");
    expect(candidates).toContain("Nassim Taleb");
  });

  it("builds a weighted query string (critical > high > medium > low)", async () => {
    const interests = [
      { topic: "AI Strategy", description: null, weight: "critical" },
      { topic: "Leadership", description: null, weight: "low" },
    ];

    await getNeonAuthorCandidates(interests, 10);

    // embedText should have been called with a string containing AI Strategy 4x and Leadership 1x
    expect(embedText).toHaveBeenCalledOnce();
    const callArg = (embedText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const aiStrategyCount = (callArg.match(/AI Strategy/g) ?? []).length;
    const leadershipCount = (callArg.match(/Leadership/g) ?? []).length;
    expect(aiStrategyCount).toBe(4); // critical weight = 4 repeats
    expect(leadershipCount).toBe(1); // low weight = 1 repeat
  });

  it("includes description in query phrase when present", async () => {
    const interests = [
      { topic: "Negotiation", description: "principled negotiation tactics", weight: "medium" },
    ];

    await getNeonAuthorCandidates(interests, 10);

    const callArg = (embedText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(callArg).toContain("Negotiation: principled negotiation tactics");
  });

  it("passes topK to queryVectors", async () => {
    const interests = [{ topic: "Finance", description: null, weight: "medium" }];
    await getNeonAuthorCandidates(interests, 42);

    expect(queryVectors).toHaveBeenCalledWith(
      expect.any(Array),
      "authors",
      { topK: 42 }
    );
  });

  it("returns empty array and does not throw when queryVectors fails", async () => {
    (queryVectors as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Neon vector unavailable"));

    const interests = [{ topic: "Risk Management", description: null, weight: "high" }];
    const candidates = await getNeonAuthorCandidates(interests, 10);

    expect(candidates).toEqual([]);
  });

  it("returns empty array and does not throw when embedText fails", async () => {
    (embedText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Gemini rate limit"));

    const interests = [{ topic: "Innovation", description: null, weight: "medium" }];
    const candidates = await getNeonAuthorCandidates(interests, 10);

    expect(candidates).toEqual([]);
  });

  it("handles hits with missing authorName metadata gracefully", async () => {
    (queryVectors as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "author-x-chunk0", score: 0.9, metadata: { authorName: "Valid Author", contentType: "author", text: "..." } },
      { id: "author-y-chunk0", score: 0.8, metadata: { contentType: "author", text: "..." } }, // missing authorName
      { id: "author-z-chunk0", score: 0.7, metadata: null }, // null metadata
    ]);

    const interests = [{ topic: "Strategy", description: null, weight: "medium" }];
    const candidates = await getNeonAuthorCandidates(interests, 10);

    // Only the valid author should be returned
    expect(candidates).toEqual(["Valid Author"]);
  });
});
