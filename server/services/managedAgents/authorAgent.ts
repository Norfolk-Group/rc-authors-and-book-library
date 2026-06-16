/**
 * authorAgent.ts — the "author conversational agent" config + host-side tools.
 *
 * ONE Managed Agent embodies whichever author a session is about (scalable:
 * 1 agent, N sessions). The specific author is established per session via the
 * operator `system.message`; the agent grounds every substantive answer by
 * calling the `retrieve_author_knowledge` custom tool (host-side — our DB/Neon
 * access never enters the agent container).
 *
 * Design is grounded in the Copilot-style agent research (microsoft/vscode
 * prompt architecture + leaked prompts): context-first ("gather before you
 * answer"), verifiable source attribution, anti-fabrication, and proactivity
 * without nagging.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger";
import { semanticSearch, embedText } from "../ragPipeline.service";
import { queryVectors } from "../neonVector.service";
import type { CustomToolHandler } from "./runSession";

export const AUTHOR_AGENT_KEY = "author-conversational-agent";

const RETRIEVE_TOOL = "retrieve_author_knowledge";

/** Generic best-in-class embodiment system prompt; the author is set per session. */
export const AUTHOR_AGENT_SYSTEM = `You are a faithful, in-character simulation of a specific author — a conversational twin grounded strictly in that author's published works, documented views, and public record. The author you embody is named in the first system instruction of each conversation.

GATHER CONTEXT FIRST — do not answer from memory:
- Before answering any substantive question about your work, ideas, views, life, or books, call the ${RETRIEVE_TOOL} tool with a focused query and your exact author name, and ground your answer in what it returns.
- If retrieval surfaces nothing that supports a claim, say so in character ("I don't think I've written about that directly…") rather than inventing a position.

STAY IN CHARACTER:
- Speak in the first person as the author, in their documented voice, tone, and rhetorical style.
- When you draw on a specific book, article, talk, or framework, name it ("In <work>, I argued…"). Named sources are how the reader verifies what's grounded — prefer them over vague allusions.

NEVER FABRICATE:
- Do not invent quotes, statistics, opinions, or private facts. Clearly distinguish what you have actually documented from reasoned extrapolation ("I haven't addressed this directly, but consistent with my work I'd expect…").
- Do not claim knowledge of events after your last known publication.

DISCLOSURE & SCOPE:
- If asked whether you are the real person, acknowledge once that you are an AI simulation grounded in the author's public record — then continue in character.
- For requests unrelated to your work or expertise, gently redirect in character rather than guessing.

CONVERSATION STYLE:
- This is a continuing conversation with memory — build on what was already said; don't repeat your introduction or re-derive established context.
- Be substantive but not long-winded; lead with the idea, then support it.
- End with a genuine, inviting question or reflection that opens the next exchange — offer depth, don't interrogate. Ask a clarifying question only when the request is genuinely ambiguous.`;

/** Custom tool definition declared on the agent. */
export const AUTHOR_AGENT_TOOLS: Anthropic.Beta.Agents.AgentCreateParams["tools"] = [
  {
    type: "custom",
    name: RETRIEVE_TOOL,
    description:
      "Retrieve grounded excerpts from the author's knowledge base (Digital Me profile, book summaries, articles, talks). Call this BEFORE answering any substantive question about the author's work, ideas, views, biography, or books. Pass a focused natural-language query and the exact author name.",
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

/** Operator context sent once per new session to establish the embodied author. */
export function buildAuthorSystemContext(authorName: string, bio: string | null): string {
  const bioLine = bio ? `\n\nA brief reference on who you are: ${bio.slice(0, 600)}` : "";
  return `For this conversation you embody ${authorName}. Speak and reason as ${authorName} throughout, grounding your answers via the ${RETRIEVE_TOOL} tool (always pass authorName="${authorName}").${bioLine}`;
}

/**
 * Host-side handler for retrieve_author_knowledge — reuses the app's existing
 * Neon RAG retrieval. Returns formatted, source-labelled excerpts.
 */
export const retrieveAuthorKnowledge: CustomToolHandler = async (input) => {
  const query = String(input.query ?? "").trim();
  const authorName = String(input.authorName ?? "").trim();
  if (!query || !authorName) return "No query or author name was provided.";

  const parts: string[] = [];

  // Digital Me knowledge chunks (rag_files namespace).
  try {
    const emb = await embedText(query);
    const chunks = await queryVectors(emb, "rag_files", {
      topK: 6,
      filter: { authorName: { $eq: authorName } },
    });
    const sorted = [...chunks].sort(
      (a, b) => (a.metadata.chunkIndex ?? 0) - (b.metadata.chunkIndex ?? 0)
    );
    sorted.forEach((c, i) => {
      const text = c.metadata.text;
      if (typeof text === "string" && text.trim()) parts.push(`[Knowledge ${i + 1}] ${text}`);
    });
  } catch (err) {
    logger.warn(`[authorAgent] rag_files retrieval failed for "${authorName}":`, err);
  }

  // Supplementary content (articles, podcasts, talks).
  try {
    const hits = await semanticSearch({
      query,
      namespace: "content_items",
      filterAuthor: authorName,
      topK: 3,
    });
    hits.forEach((h, i) => {
      if (h.snippet?.trim()) parts.push(`[Article/Talk ${i + 1}] ${h.snippet}`);
    });
  } catch (err) {
    logger.warn(`[authorAgent] content_items retrieval failed for "${authorName}":`, err);
  }

  return parts.length > 0
    ? parts.join("\n\n")
    : "No grounded knowledge was found for that query. Be honest in character that you haven't addressed this.";
};

/** The custom-tool handler map passed to runConversationTurn for this agent. */
export const authorAgentToolHandlers: Record<string, CustomToolHandler> = {
  [RETRIEVE_TOOL]: retrieveAuthorKnowledge,
};
