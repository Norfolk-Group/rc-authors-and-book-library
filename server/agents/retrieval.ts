/**
 * retrieval.ts — knowledge retrieval for the Super Conversations agents.
 *
 * Thin wrapper over the per-author Neon namespaces (`author_<id>`) populated by
 * scripts/index-book-content.cjs. Every agent grounds its answers in passages
 * retrieved here; this is the single retrieval surface the agent runtime exposes
 * as a tool, so the model can only speak from indexed sources.
 *
 * - A Book agent restricts to one book via `bookCategory` ("book-<bookId>").
 * - An Author agent searches the author's whole corpus (books + notes).
 */
import { embedText } from "../services/ragPipeline.service";
import { queryAuthorKnowledge } from "../services/neonVector.service";

export interface RetrievedExcerpt {
  title: string;
  /** "book" | "owner_notes" | "doc" */
  kind: string;
  text: string;
  url?: string;
  score: number;
}

export async function retrieveExcerpts(
  authorId: number,
  query: string,
  opts: { topK?: number; bookCategory?: string; notesOnly?: boolean } = {}
): Promise<RetrievedExcerpt[]> {
  const embedding = await embedText(query);
  const hits = await queryAuthorKnowledge(authorId, embedding, {
    topK: opts.topK ?? 8,
    category: opts.bookCategory,
    contentTypes: opts.notesOnly ? ["owner_notes"] : undefined,
  });
  return hits.map((h) => ({
    title: h.metadata.title || "Untitled",
    kind: h.metadata.contentType,
    text: h.metadata.text,
    url: h.metadata.url,
    score: h.score,
  }));
}

/**
 * Render excerpts as a numbered, provenance-labelled block for injection into a
 * tool result. Each entry tells the model exactly what it is citing.
 */
export function formatExcerpts(excerpts: RetrievedExcerpt[]): string {
  if (excerpts.length === 0) return "(no relevant passages were found in the indexed sources)";
  return excerpts
    .map((e, i) => {
      const label =
        e.kind === "owner_notes"
          ? `Reader's notes on "${e.title}"`
          : e.kind === "book"
          ? `"${e.title}"`
          : e.title;
      return `[${i + 1}] Source: ${label}\n${e.text}`;
    })
    .join("\n\n");
}
