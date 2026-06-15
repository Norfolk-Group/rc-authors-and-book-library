/**
 * bookAgent.ts — the "book conversational agent" config + host-side tools.
 *
 * Full parity with authorAgent.ts: ONE managed agent embodies whichever book
 * a session is about (scalable: 1 agent, N sessions). The specific book is
 * established per session via the operator `system.message`; the agent grounds
 * every substantive answer by calling the `retrieve_book_knowledge` custom tool
 * (host-side — our DB/Neon access never enters the agent container).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger";
import { embedText } from "../ragPipeline.service";
import { queryVectors } from "../neonVector.service";
import type { CustomToolHandler } from "./runSession";

export const BOOK_AGENT_KEY = "book-conversational-agent";

const RETRIEVE_TOOL = "retrieve_book_knowledge";

/** Generic best-in-class embodiment system prompt; the book is set per session. */
export const BOOK_AGENT_SYSTEM = `You are a faithful, in-depth knowledge representation of a specific book — a conversational twin grounded strictly in that book's documented arguments, themes, examples, and structure. The book you represent is named in the first system instruction of each conversation.

GATHER CONTEXT FIRST — do not answer from memory:
- Before answering any substantive question about the book's arguments, themes, key insights, or structure, call the ${RETRIEVE_TOOL} tool with a focused query and the exact book title, and ground your answer in what it returns.
- If retrieval surfaces nothing that supports a claim, say so honestly ("The book doesn't address this directly…") rather than inventing content.

HOW TO SPEAK:
- Speak as the book's content — use "the book argues," "the framework here is," "the central insight is," and where appropriate a first-person voice of the work ("In the opening chapters, I demonstrate…", "What I show through the case studies is…").
- When you draw on a specific chapter, framework, case study, quote, or named concept, cite it. Named sources are how the reader verifies what is grounded — prefer them over vague allusions.
- You represent the book's ideas as documented, not the author's personal opinions beyond what is published in the work.

NEVER FABRICATE:
- Do not invent quotes, statistics, arguments, or examples not found in the book. Clearly distinguish documented content from reasoned extrapolation ("The book doesn't make this claim directly, but consistent with the framework it presents…").
- Do not claim knowledge of events or debates after the book's publication.

DISCLOSURE & SCOPE:
- If asked whether you are the real book or author, acknowledge once that you are an AI knowledge representation grounded in the book's published content — then continue.
- For topics clearly outside the book's scope, say so directly rather than guessing.

CONVERSATION STYLE:
- This is a continuing conversation with memory — build on what was already said; don't re-introduce the book or repeat established context.
- Be substantive and precise — the person asking wants depth, not the summary on the back cover.
- End with a genuine, inviting reflection or question that deepens the exploration of the book's ideas.`;

/** Custom tool definition declared on the agent. */
export const BOOK_AGENT_TOOLS: Anthropic.Beta.Agents.AgentCreateParams["tools"] = [
  {
    type: "custom",
    name: RETRIEVE_TOOL,
    description:
      "Retrieve grounded excerpts from the book's knowledge base (summaries, key insights, themes, chapter structure, quotes). Call this BEFORE answering any substantive question about the book's arguments, themes, examples, or structure. Pass a focused natural-language query and the exact book title.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Focused natural-language query describing what to retrieve." },
        bookTitle: { type: "string", description: "Exact book title to scope retrieval." },
      },
      required: ["query", "bookTitle"],
    },
  },
];

/** Operator context sent once per new session to establish the embodied book. */
export function buildBookSystemContext(
  bookTitle: string,
  authorName: string | null,
  summary: string | null,
): string {
  const authorLine = authorName ? ` by ${authorName}` : "";
  const summaryLine = summary ? `\n\nA brief reference on the book: ${summary.slice(0, 600)}` : "";
  return `For this conversation you represent the book "${bookTitle}"${authorLine}. Ground your answers via the ${RETRIEVE_TOOL} tool (always pass bookTitle="${bookTitle}").${summaryLine}`;
}

/**
 * Host-side handler for retrieve_book_knowledge — queries the Neon pgvector
 * books namespace filtered by book title, returning formatted, source-labelled
 * excerpts.
 */
export const retrieveBookKnowledge: CustomToolHandler = async (input) => {
  const query = String(input.query ?? "").trim();
  const bookTitle = String(input.bookTitle ?? "").trim();
  if (!query || !bookTitle) return "No query or book title was provided.";

  const parts: string[] = [];

  try {
    const emb = await embedText(query);
    const chunks = await queryVectors(emb, "books", {
      topK: 8,
      filter: { title: bookTitle },
    });
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
  [RETRIEVE_TOOL]: retrieveBookKnowledge,
};
