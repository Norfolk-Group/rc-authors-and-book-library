/**
 * chunking.service.ts — split long text into RAG-ready chunks.
 *
 * Heuristic: chunk by approximate token count (≈ 4 chars per token) with a
 * configurable overlap, but split only at semantic boundaries (paragraph,
 * sentence, then word). This avoids cutting sentences in half and gives the
 * embedding model coherent chunks to work with.
 *
 * No native dependency (tiktoken would add one). The 4-char heuristic is the
 * standard portable approximation — it overcounts a bit for technical prose and
 * undercounts for code, both of which are fine within a 200-token margin.
 */

const CHARS_PER_TOKEN = 4;

export type ChunkOptions = {
  /** Target chunk size in approximate tokens (default 800 ≈ 3200 chars). */
  targetTokens?: number;
  /** Overlap between adjacent chunks in approximate tokens (default 100). */
  overlapTokens?: number;
  /** Minimum chunk size; smaller leftover gets merged into the previous chunk. */
  minTokens?: number;
};

export type Chunk = {
  text: string;
  index: number;
  approxTokens: number;
};

function approxTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Find the best split point at or before `targetIndex` in the source text.
 * Preference order: paragraph break, sentence end, word boundary, hard cut.
 */
function findSplit(text: string, targetIndex: number): number {
  if (targetIndex >= text.length) return text.length;
  // Search backward from the target for a clean break, but not too far —
  // limit how much we'll sacrifice to land on a boundary.
  const minSearch = Math.max(0, targetIndex - 400);

  // 1. Paragraph break.
  const para = text.lastIndexOf("\n\n", targetIndex);
  if (para >= minSearch) return para + 2;

  // 2. Sentence-ending punctuation followed by whitespace.
  const sentenceRe = /[.!?]\s/g;
  let bestSentence = -1;
  let m: RegExpExecArray | null;
  sentenceRe.lastIndex = minSearch;
  while ((m = sentenceRe.exec(text)) !== null) {
    if (m.index > targetIndex) break;
    bestSentence = m.index + m[0].length;
  }
  if (bestSentence >= minSearch) return bestSentence;

  // 3. Word boundary.
  const space = text.lastIndexOf(" ", targetIndex);
  if (space >= minSearch) return space + 1;

  // 4. Hard cut.
  return targetIndex;
}

/**
 * Split text into overlapping, boundary-aware chunks suitable for embedding.
 * Returns an empty array for empty/whitespace input.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const targetTokens = options.targetTokens ?? 800;
  const overlapTokens = options.overlapTokens ?? 100;
  const minTokens = options.minTokens ?? 80;

  // Guard against pathological option combinations that would otherwise degrade
  // into infinite/empty slicing.
  if (targetTokens <= 0) throw new Error("chunkText: targetTokens must be > 0");
  if (overlapTokens < 0 || overlapTokens >= targetTokens) {
    throw new Error("chunkText: overlapTokens must be >= 0 and < targetTokens");
  }
  if (minTokens < 0) throw new Error("chunkText: minTokens must be >= 0");

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const minChars = minTokens * CHARS_PER_TOKEN;

  // Short enough to be a single chunk.
  if (cleaned.length <= targetChars) {
    return [{ text: cleaned, index: 0, approxTokens: approxTokens(cleaned) }];
  }

  const chunks: Chunk[] = [];
  let cursor = 0;
  while (cursor < cleaned.length) {
    const targetEnd = Math.min(cleaned.length, cursor + targetChars);
    const end = findSplit(cleaned, targetEnd);
    const slice = cleaned.slice(cursor, end).trim();
    if (slice) {
      // If the LAST slice would be tiny, glue it onto the previous chunk
      // instead of emitting a runt.
      if (slice.length < minChars && chunks.length > 0 && end >= cleaned.length) {
        const last = chunks[chunks.length - 1];
        last.text = `${last.text}\n\n${slice}`.trim();
        last.approxTokens = approxTokens(last.text);
        break;
      }
      chunks.push({
        text: slice,
        index: chunks.length,
        approxTokens: approxTokens(slice),
      });
    }
    if (end >= cleaned.length) break;
    cursor = Math.max(cursor + 1, end - overlapChars);
  }
  return chunks;
}
