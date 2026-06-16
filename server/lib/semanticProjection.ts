/**
 * semanticProjection.ts
 *
 * Dimensionality reduction for the Semantic Interest Heatmap.
 *
 * Projects high-dimensional embedding vectors (Gemini, 1536-dim) down to 2D
 * using UMAP (Uniform Manifold Approximation and Projection). UMAP preserves
 * local neighbourhood structure far better than a linear PCA projection, so
 * semantically similar authors/books cluster together visually.
 *
 * Vectors are L2-normalized first so UMAP's Euclidean metric reflects cosine
 * similarity — the same similarity measure used by the Neon pgvector
 * recommendation engine elsewhere in the app.
 */

import { UMAP } from "umap-js";

export type Point2D = { x: number; y: number };

/** L2-normalize a vector so Euclidean distance approximates cosine distance. */
export function l2normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm < 1e-12) return v.slice();
  return v.map((x) => x / norm);
}

/** Seeded PRNG (mulberry32) so UMAP layouts are reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rescale 2D coordinates into the [0.05, 0.95] box on both axes. */
function normalizeCoords(coords: Array<[number, number]>): Point2D[] {
  if (coords.length === 0) return [];
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  return coords.map((c) => ({
    x: 0.05 + ((c[0] - xMin) / xRange) * 0.9,
    y: 0.05 + ((c[1] - yMin) / yRange) * 0.9,
  }));
}

/** Deterministic ring layout used as a fallback for tiny / degenerate inputs. */
function ringLayout(n: number): Point2D[] {
  if (n === 1) return [{ x: 0.5, y: 0.5 }];
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return {
      x: 0.5 + 0.42 * Math.cos(angle),
      y: 0.5 + 0.42 * Math.sin(angle),
    };
  });
}

/**
 * Project high-dimensional vectors to 2D with UMAP.
 *
 * - Output is normalized into [0.05, 0.95] on both axes.
 * - Inputs with fewer than 4 points (too few for a meaningful neighbourhood
 *   graph) get a deterministic ring layout instead.
 * - Any UMAP failure falls back to the ring layout so the endpoint never throws.
 */
export function projectTo2D(vectors: number[][]): Point2D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n < 4) return ringLayout(n);

  const normalized = vectors.map(l2normalize);
  // nNeighbors must be strictly less than the point count; UMAP's default is 15.
  const nNeighbors = Math.max(2, Math.min(15, n - 1));

  try {
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors,
      minDist: 0.1,
      random: mulberry32(42),
    });
    const embedding = umap.fit(normalized) as number[][];
    return normalizeCoords(embedding.map((c) => [c[0], c[1]] as [number, number]));
  } catch {
    return ringLayout(n);
  }
}
