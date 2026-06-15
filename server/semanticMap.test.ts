/**
 * semanticMap.test.ts
 *
 * Tests for the Semantic Map router helper functions:
 *   - deterministicJitter: stable pseudo-random jitter based on name
 *   - parsePrimaryTag: extracts first tag from tagsJson
 *   - projectTo2D / l2normalize: UMAP 2D projection (imported from the real module)
 */

import { describe, it, expect } from "vitest";
import { projectTo2D, l2normalize } from "./lib/semanticProjection";

// ── Re-implement name/tag helpers here for unit testing (not exported from the router) ──

function deterministicJitter(name: string, spread: number): { dx: number; dy: number } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const dx = (((hash & 0xffff) / 0xffff) - 0.5) * spread;
  const dy = ((((hash >> 16) & 0xffff) / 0xffff) - 0.5) * spread;
  return { dx, dy };
}

function parsePrimaryTag(tagsJson: string | null): string {
  if (!tagsJson) return "Uncategorized";
  try {
    const tags = JSON.parse(tagsJson);
    if (Array.isArray(tags) && tags.length > 0) return String(tags[0]);
  } catch { /* ignore */ }
  return "Uncategorized";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deterministicJitter", () => {
  it("returns the same values for the same name (deterministic)", () => {
    const a = deterministicJitter("Adam Grant", 0.12);
    const b = deterministicJitter("Adam Grant", 0.12);
    expect(a.dx).toBe(b.dx);
    expect(a.dy).toBe(b.dy);
  });

  it("returns different values for different names", () => {
    const a = deterministicJitter("Adam Grant", 0.12);
    const b = deterministicJitter("Malcolm Gladwell", 0.12);
    expect(a.dx).not.toBe(b.dx);
  });

  it("jitter magnitude is within spread bounds", () => {
    const spread = 0.12;
    const { dx, dy } = deterministicJitter("Test Author", spread);
    expect(Math.abs(dx)).toBeLessThanOrEqual(spread / 2 + 0.001);
    expect(Math.abs(dy)).toBeLessThanOrEqual(spread / 2 + 0.001);
  });

  it("handles empty string name", () => {
    const { dx, dy } = deterministicJitter("", 0.1);
    expect(typeof dx).toBe("number");
    expect(typeof dy).toBe("number");
  });
});

describe("parsePrimaryTag", () => {
  it("returns first tag from valid JSON array", () => {
    expect(parsePrimaryTag('["Psychology"]')).toBe("Psychology");
    expect(parsePrimaryTag('["Business", "Leadership"]')).toBe("Business");
  });

  it("returns Uncategorized for null", () => {
    expect(parsePrimaryTag(null)).toBe("Uncategorized");
  });

  it("returns Uncategorized for empty array", () => {
    expect(parsePrimaryTag("[]")).toBe("Uncategorized");
  });

  it("returns Uncategorized for invalid JSON", () => {
    expect(parsePrimaryTag("not-json")).toBe("Uncategorized");
    expect(parsePrimaryTag("{invalid}")).toBe("Uncategorized");
  });

  it("returns Uncategorized for non-array JSON", () => {
    expect(parsePrimaryTag('{"tag": "Business"}')).toBe("Uncategorized");
  });

  it("converts non-string tag to string", () => {
    expect(parsePrimaryTag("[42]")).toBe("42");
  });
});

describe("l2normalize", () => {
  it("returns a unit-length vector", () => {
    const out = l2normalize([3, 4]);
    const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(0.6, 6);
    expect(out[1]).toBeCloseTo(0.8, 6);
  });

  it("returns a zero vector unchanged (no divide-by-zero)", () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("projectTo2D", () => {
  it("returns empty array for empty input", () => {
    expect(projectTo2D([])).toEqual([]);
  });

  it("centers a single vector", () => {
    const result = projectTo2D([[1, 2, 3]]);
    expect(result).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  it("uses a deterministic ring layout for fewer than 4 points", () => {
    const result = projectTo2D([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(result).toHaveLength(3);
    for (const p of result) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("projects a UMAP-eligible set (>=4 points) into [0.05, 0.95]", () => {
    const vectors = Array.from({ length: 12 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) => Math.sin(i * j + 1))
    );
    const result = projectTo2D(vectors);
    expect(result).toHaveLength(12);
    const xs = result.map(p => p.x);
    const ys = result.map(p => p.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.95 + 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0.95 + 1e-9);
  });

  it("is deterministic across runs (seeded)", () => {
    const vectors = Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => Math.cos(i + j))
    );
    const a = projectTo2D(vectors);
    const b = projectTo2D(vectors);
    expect(a).toEqual(b);
  });

  it("handles identical vectors without crashing", () => {
    const vectors = Array.from({ length: 5 }, () => [1, 2, 3]);
    expect(() => projectTo2D(vectors)).not.toThrow();
  });
});

describe("Semantic Map integration shape", () => {
  it("produces valid SemanticMapPoint shape from helper functions", () => {
    const name = "Adam Grant";
    const tagsJson = '["Psychology"]';
    const cat = parsePrimaryTag(tagsJson);
    const { dx, dy } = deterministicJitter(name, 0.12);
    const cx = 0.40, cy = 0.15;
    const x = Math.max(0.02, Math.min(0.98, cx + dx));
    const y = Math.max(0.02, Math.min(0.98, cy + dy));

    expect(cat).toBe("Psychology");
    expect(x).toBeGreaterThanOrEqual(0.02);
    expect(x).toBeLessThanOrEqual(0.98);
    expect(y).toBeGreaterThanOrEqual(0.02);
    expect(y).toBeLessThanOrEqual(0.98);
  });
});
