import { describe, it, expect } from "vitest";
import { chunkText } from "./chunking.service";

describe("chunkText", () => {
  it("returns empty for empty / whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n   ")).toEqual([]);
  });

  it("returns one chunk for short text", () => {
    const result = chunkText("This is a short sentence.");
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
    expect(result[0].text).toBe("This is a short sentence.");
  });

  it("splits long text into multiple chunks with sequential indices", () => {
    const paragraph = "This is a sentence. ".repeat(100); // ~2000 chars
    const longText = (paragraph + "\n\n").repeat(4); // ~8000+ chars
    const chunks = chunkText(longText, { targetTokens: 200, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("respects target token size approximately", () => {
    const text = "word ".repeat(4000); // ~20,000 chars ≈ 5000 tokens
    const chunks = chunkText(text, { targetTokens: 500, overlapTokens: 50 });
    // Each chunk's approxTokens should be near 500 (allow some slack for boundary search).
    for (const c of chunks.slice(0, -1)) {
      expect(c.approxTokens).toBeLessThan(700);
    }
  });

  it("creates overlap between consecutive chunks", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(80);
    const chunks = chunkText(text, { targetTokens: 200, overlapTokens: 50 });
    if (chunks.length >= 2) {
      const a = chunks[0].text;
      const b = chunks[1].text;
      // Some suffix of a should appear at the start of b.
      const suffix = a.slice(-80).trim();
      const firstNonOverlap = b.slice(0, 200);
      // Loose check: at least one word from the tail of the previous chunk
      // should appear near the start of the next.
      const tailWords = suffix.split(/\s+/).filter(Boolean).slice(-3);
      const found = tailWords.some((w) => firstNonOverlap.includes(w));
      expect(found).toBe(true);
    }
  });

  it("merges tiny trailing fragments instead of emitting runts", () => {
    // Build a text just over the target so the natural split would leave a
    // very short remainder; the merger should fold it into the previous chunk.
    const main = "word ".repeat(800); // ~4000 chars
    const tail = "tiny tail.";
    const chunks = chunkText(main + tail, { targetTokens: 800, overlapTokens: 50, minTokens: 100 });
    const last = chunks[chunks.length - 1];
    expect(last.text.length).toBeGreaterThan(400); // not a runt
  });
});
