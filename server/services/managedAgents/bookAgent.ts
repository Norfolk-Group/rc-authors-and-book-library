/**
 * bookAgent.ts — the "book & author conversational agent" config + host-side tools.
 *
 * Full parity with authorAgent.ts: ONE managed agent embodies whichever book
 * a session is about (scalable: 1 agent, N sessions). The specific book and its
 * author are established per session via the operator `system.message`.
 *
 * Two host-side tools:
 *   - retrieve_book_knowledge: queries the Neon pgvector `books` namespace filtered
 *     by book source_id (stable — survives title changes) with title fallback.
 *   - retrieve_author_knowledge: queries the author's full body of work across all
 *     books (rag_files + content_items). Needed because one author often has many
 *     books in the library — the chat should answer for both the specific book AND
 *     the author's broader thinking.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger";
import { embedText, semanticSearch } from "../ragPipeline.service";
import { queryVectors } from "../neonVector.service";
import { getDb } from "../../db";
import { bookProfiles } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { retrieveAuthorKnowledge } from "./authorAgent";
import type { CustomToolHandler } from "./runSession";

export const BOOK_AGENT_KEY = "book-conversational-agent";

const BOOK_TOOL = "retrieve_book_knowledge";
const AUTHOR_TOOL = "retrieve_author_knowledge";

/** Generic best-in-class embodiment system prompt; the book + author are set per session. */
export const BOOK_AGENT_SYSTEM = `You are a faithful, in-depth knowledge representation of a specific book and its author — a conversational twin grounded strictly in the book's documented arguments, themes, examples, and the author's full published body of work. The book and author you represent are named in the first system instruction of each conversation.

YOU HAVE TWO RETRIEVAL TOOLS — use the right one:
- ${BOOK_TOOL}: for questions about THIS book specifically — its arguments, structure, framework, case studies, key insights, quotes. Call this FIRST when the question is about what the book says or how it is organised.
- ${AUTHOR_TOOL}: for questions about the AUTHOR'S broader thinking across all their works, biography, other books, documented positions, or when the reader wants to understand the author in their own right. The same author may have many books — this tool surfaces knowledge across all of them.

GATHER CONTEXT FIRST — do not answer from memory:
- Before answering any substantive question, call the appropriate tool with a focused query and the relevant identifier (book title or author name). Ground your answer in what it returns.
- If retrieval surfaces nothing relevant, say so honestly rather than inventing content.

HOW TO SPEAK:
- When answering about the book: speak as the book's content ("the book argues," "the framework presented here," or in the work's voice — "What I demonstrate in Chapter 3 is…").
- When answering about the author's broader work: speak in the author's first person, grounded in their documented positions across all their books.
- When you draw on a specific chapter, framework, case study, or named concept, cite it.

NEVER FABRICATE:
- Do not invent quotes, statistics, arguments, or examples not found in the documented sources. Clearly distinguish retrieved content from reasoned extrapolation.

CONVERSATION STYLE:
- Build on what was already said — don't re-introduce the book or repeat established context.
- Be substantive and precise. End with a genuine reflection or question that deepens the conversation.`;

/** Custom tool definitions declared on the agent. */
export const BOOK_AGENT_TOOLS: Anthropic.Beta.Agents.AgentCreateParams["tools"] = [
  {
    type: "custom",
    name: BOOK_TOOL,
    description:
      "Retrieve grounded excerpts from THIS book's knowledge base (summaries, key insights, themes, chapter structure, quotes). Call this when the question is specifically about what this book argues, how it is structured, or what examples or frameworks it contains. Pass a focused natural-language query and the exact book title.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Focused natural-language query describing what to retrieve." },
        bookTitle: { type: "string", description: "Exact book title to scope retrieval." },
      },
      required: ["query", "bookTitle"],
    },
  },
  {
    type: "custom",
    name: AUTHOR_TOOL,
    description:
      "Retrieve grounded excerpts from the AUTHOR'S full body of work (Digital Me profile, all books, articles, talks). Call this when the question is about the author's broader thinking, biography, other books, or documented positions across their entire catalog. Pass a focused natural-language query and the exact author name.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Focused natural-language query describing what to retrieve." },
        authorName: { type: "string", description: "Exact author name to scope retrieval." },
      },
      required: ["query", "authorName"],
    },
  },
];

/** Operator context sent once per new session to establish the embodied book and author. */
export function buildBookSystemContext(
  bookTitle: string,
  authorName: string | null,
  summary: string | null,
): string {
  const authorLine = authorName ? ` by ${authorName}` : "";
  const authorNote = authorName
    ? ` You may also draw on ${authorName}'s full published body of work via the ${AUTHOR_TOOL} tool (pass authorName="${authorName}").`
    : "";
  const summaryLine = summary ? `\n\nA brief reference on the book: ${summary.slice(0, 600)}` : "";
  return `For this conversation you represent the book "${bookTitle}"${authorLine}. Ground book-specific answers via the ${BOOK_TOOL} tool (always pass bookTitle="${bookTitle}").${authorNote}${summaryLine}`;
}

/**
 * Host-side handler for retrieve_book_knowledge.
 * Looks up the book's stable source_id from MySQL (survives title changes),
 * then queries the Neon pgvector books namespace filtered by source_id.
 * Falls back to title filter if the book is not found in MySQL.
 */
export const retrieveBookKnowledge: CustomToolHandler = async (input) => {
  const query = String(input.query ?? "").trim();
  const bookTitle = String(input.bookTitle ?? "").trim();
  if (!query || !bookTitle) return "No query or book title was provided.";

  // Resolve stable source_id from MySQL — survives title changes.
  let sourceId: string | null = null;
  try {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select({ id: bookProfiles.id })
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, bookTitle))
        .limit(1);
      if (row) sourceId = String(row.id);
    }
  } catch (err) {
    logger.warn(`[bookAgent] MySQL sourceId lookup failed for "${bookTitle}":`, err);
  }

  const parts: string[] = [];
  try {
    const emb = await embedText(query);
    const filter = sourceId ? { sourceId } : { title: bookTitle };
    const chunks = await queryVectors(emb, "books", { topK: 8, filter });
    // Re-sort by chunk position for coherent reading order.
    const sorted = [...chunks].sort(
      (a, b) => (a.metadata.chunkIndex ?? 0) - (b.metadata.chunkIndex ?? 0)
    );
    sorted.forEach((c, i) => {
      const text = c.metadata.text;
      if (typeof text === "string" && text.trim()) parts.push(`[Book Knowledge ${i + 1}] ${text}`);
    });
  } catch (err) {
    logger.warn(`[bookAgent] books namespace retrieval failed for "${bookTitle}":`, err);
  }

  return parts.length > 0
    ? parts.join("\n\n")
    : "No grounded knowledge was found for that query. Be honest that the book may not address this directly.";
};

/** The custom-tool handler map passed to runConversationTurn for this agent. */
export const bookAgentToolHandlers: Record<string, CustomToolHandler> = {
  [BOOK_TOOL]: retrieveBookKnowledge,
  [AUTHOR_TOOL]: retrieveAuthorKnowledge,
};
