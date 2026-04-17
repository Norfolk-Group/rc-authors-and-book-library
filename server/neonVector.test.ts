/**
 * neonVector.test.ts
 *
 * Pure unit tests for the Neon pgvector service helpers.
 * The @neondatabase/serverless module is mocked to avoid loading the heavy
 * SDK in the constrained sandbox vitest worker (which causes OOM).
 *
 * Live Neon connectivity is validated by running:
 *   node scripts/test_neon_connection.mjs
 */
import { describe, it, expect, vi } from "vitest";

// Mock the Neon driver BEFORE importing the service so the module never loads
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const fn = vi.fn().mockResolvedValue([]);
    fn.query = vi.fn().mockResolvedValue([]);
    return fn;
  },
}));

import {
  chunkText,
  makeVectorId,
  EMBEDDING_DIMENSION,
} from "./services/neonVector.service";

describe("neonVector.service — unit tests (Neon SDK mocked)", () => {
  it("EMBEDDING_DIMENSION is 1536 (pgvector HNSW compatible)", () => {
    expect(EMBEDDING_DIMENSION).toBe(1536);
  });

  it("chunkText returns the input unchanged when it fits in one chunk", () => {
    const short = "Hello world. This is a short text.";
    const chunks = chunkText(short);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(short);
  });

  it("chunkText splits long text into multiple overlapping chunks", () => {
    const longText = "word ".repeat(600); // ~3000 chars, exceeds 2000-char default
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => expect(c.length).toBeGreaterThan(50));
  });

  it("chunkText filters out chunks shorter than 50 chars", () => {
    const text = "A ".repeat(1000); // many short words
    const chunks = chunkText(text);
    chunks.forEach(c => expect(c.length).toBeGreaterThan(50));
  });

  it("makeVectorId generates stable, predictable IDs", () => {
    expect(makeVectorId("book", "my-book-123", 0)).toBe("book-my-book-123-chunk0");
    expect(makeVectorId("author", "adam-grant", 2)).toBe("author-adam-grant-chunk2");
    expect(makeVectorId("article", "nyt-2024-01", 0)).toBe("article-nyt-2024-01-chunk0");
  });

  it("makeVectorId sanitises special characters in sourceId", () => {
    const id = makeVectorId("book", "Book Title: With Spaces & Symbols!", 0);
    // Only alphanumeric, hyphens and underscores allowed
    expect(id).toMatch(/^[a-zA-Z0-9-_]+$/);
  });

  it("makeVectorId truncates very long sourceIds to 60 chars", () => {
    const longId = "a".repeat(100);
    const id = makeVectorId("book", longId, 0);
    // format: "book-" + up to 60 chars + "-chunk0"
    expect(id.length).toBeLessThanOrEqual("book-".length + 60 + "-chunk0".length);
  });
});
