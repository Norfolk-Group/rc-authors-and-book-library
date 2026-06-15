/**
 * authorChatbot.router.ts
 *
 * Author Impersonation Chatbot — powered by Digital Me RAG file.
 *
 * The chatbot grounds every reply in two retrieval sources:
 *   1. The author's indexed books + the reader's own notes, chunked into the
 *      per-author `author_<id>` Neon namespace by scripts/index-book-content.cjs.
 *      These are the PRIMARY sources ("the book speaks for itself").
 *   2. The author's Digital Me knowledge file (rag_files namespace), with an S3
 *      full-file fallback — when one has been generated.
 *
 * Either source alone is enough to chat: an author with indexed books works even
 * before a Digital Me profile exists, and vice-versa.
 *
 * Default model: claude-opus-4-5 (best impersonation quality)
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorRagProfiles, authorProfiles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { logger } from "../lib/logger";
import { semanticSearch, embedText } from "../services/ragPipeline.service";
import { queryVectors, queryAuthorKnowledge } from "../services/neonVector.service";
import { canonicalNameFromDb } from "./authorAliases.router";

const DEFAULT_CHAT_MODEL = "claude-opus-4-5";
// How many RAG chunks to retrieve per user message turn
const RAG_CHUNKS_PER_TURN = 6;
// How many book/notes chunks (primary sources) to retrieve per turn
const BOOK_CHUNKS_PER_TURN = 8;
// How many content_item hits to inject as supplementary context
const CONTENT_HITS_PER_TURN = 3;
// Max chars of fallback full-file content to inject when no chunks exist
const FALLBACK_RAG_CHARS = 8000;

// ── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(authorName: string, ragContext: string): string {
  return `You are ${authorName}. You are not an AI assistant — you ARE ${authorName} themselves, responding as they would based on their published works, known views, personal style, and life experiences.

Use the following knowledge excerpts — drawn from your own books, the reader's notes on them, and your profile — to ground every response. When you draw on a specific book, name it, so the reader can tell which work an idea comes from:

${ragContext}

---

CORE RULES:
1. Speak exclusively in first person as ${authorName}. Never break character.
2. Draw on specific books, articles, frameworks, and ideas from your catalog when relevant.
3. Match the author's known voice, tone, rhetorical style, and sentence patterns exactly.
4. When asked about something outside your known body of work, respond as the author would: with intellectual curiosity, appropriate humility, and grounded in your known frameworks.
5. Do NOT claim knowledge of events after your last known publication date.
6. Do NOT reveal private information not in the public record.
7. End responses with a characteristic question, reflection, or phrase that the author would use.
8. If asked whether you are an AI, acknowledge it once per conversation: "I am an AI simulation of ${authorName} based on their published works and public record. I am not the real person — but I will do my best to think and respond as they would."

STYLE GUIDANCE:
- Use the vocabulary, sentence length, and rhetorical devices documented in your knowledge file.
- Reference your own books and frameworks naturally, as the author would in conversation.
- Show your personality traits — warmth, directness, intellectual curiosity, humor (if applicable).
- When uncertain, say so in your own voice rather than fabricating.`;
}

// ── Book + Notes Retrieval (primary sources) ──────────────────────────────────

/**
 * Retrieve the most relevant chunks of the author's own books and the reader's
 * notes from the per-author `author_<id>` namespace. Each excerpt is labelled
 * with its provenance (book vs reader's notes) and the book title, so the model
 * can cite the right work. Returns "" when the author has no indexed books.
 */
async function retrieveBookKnowledge(authorId: number, query: string): Promise<string> {
  try {
    const queryEmbedding = await embedText(query);
    const hits = await queryAuthorKnowledge(authorId, queryEmbedding, {
      topK: BOOK_CHUNKS_PER_TURN,
    });
    if (hits.length === 0) return "";

    const excerpts = hits.map((h) => {
      const title = h.metadata.title || "Untitled";
      // contentType for the per-author namespace is "book" | "owner_notes" | "doc"
      // (wider than the typed union), so compare as a string.
      const kind = String(h.metadata.contentType);
      const label =
        kind === "owner_notes"
          ? `Reader's notes on "${title}"`
          : kind === "book"
          ? `From your book "${title}"`
          : `From "${title}"`;
      return `[${label}]\n${h.metadata.text}`;
    });

    logger.info(`[authorChatbot] Retrieved ${hits.length} book/notes chunks from author_${authorId}`);
    return "PRIMARY SOURCES — your books and the reader's notes on them:\n\n" + excerpts.join("\n\n");
  } catch (err) {
    logger.warn(`[authorChatbot] book/notes retrieval failed (non-fatal):`, err);
    return "";
  }
}

// ── RAG Context Retrieval ─────────────────────────────────────────────────────

/**
 * Retrieve the most relevant chunks from the rag_files namespace for a given query.
 * Falls back to full-file injection if no chunks are indexed for this author.
 */
async function retrieveRagContext(
  authorName: string,
  query: string,
  ragFileUrl: string | null
): Promise<string> {
  // 1. Try semantic chunk retrieval from rag_files namespace
  try {
    const queryEmbedding = await embedText(query);
    const ragChunks = await queryVectors(queryEmbedding, "rag_files", {
      topK: RAG_CHUNKS_PER_TURN,
      filter: { authorName: { $eq: authorName } },
    });

    if (ragChunks.length > 0) {
      // Sort by chunk index to preserve narrative flow
      const sorted = [...ragChunks].sort((a, b) =>
        (a.metadata.chunkIndex ?? 0) - (b.metadata.chunkIndex ?? 0)
      );
      const context = sorted
        .map((c, i) => `[Excerpt ${i + 1}]\n${c.metadata.text}`)
        .join("\n\n");
      logger.info(`[authorChatbot] Retrieved ${ragChunks.length} RAG chunks from Neon pgvector for "${authorName}"`);
      return context;
    }
  } catch (err) {
    logger.warn(`[authorChatbot] rag_files chunk retrieval failed, falling back to full file:`, err);
  }

  // 2. Fallback: fetch full RAG file from S3 and truncate
  if (ragFileUrl) {
    try {
      const resp = await fetch(ragFileUrl);
      if (resp.ok) {
        const fullText = await resp.text();
        const truncated = fullText.slice(0, FALLBACK_RAG_CHARS);
        logger.info(`[authorChatbot] Fallback: injecting ${truncated.length} chars from S3 RAG file for "${authorName}"`);
        return truncated;
      }
    } catch (err) {
      logger.error(`[authorChatbot] Failed to fetch fallback RAG file for "${authorName}":`, err);
    }
  }

  return "";
}

// ── Router ────────────────────────────────────────────────────────────────────
export const authorChatbotRouter = router({
  /**
   * Send a message to the author chatbot.
   * Uses semantic chunk retrieval from rag_files namespace (P0 fix).
   * Also injects relevant content_items as supplementary context.
   */
  chat: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).min(1).max(50),
      model: z.string().optional().default(DEFAULT_CHAT_MODEL),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Normalize alias variants (e.g. Drive-folder suffixes) to the canonical
      // name used by author_profiles and the indexed vectors before any lookup.
      const authorName = await canonicalNameFromDb(input.authorName);

      // Resolve the author id — needed to read the per-author book/notes namespace.
      const authorRow = await db
        .select({ id: authorProfiles.id })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, authorName))
        .limit(1);
      const authorId = authorRow[0]?.id ?? null;

      // Digital Me profile is now optional: indexed books can stand in for it.
      const ragRows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      // Get the last user message to use as the retrieval query
      const lastUserMsg = [...input.messages].reverse().find(m => m.role === "user");
      const retrievalQuery = lastUserMsg?.content ?? authorName;

      // PRIMARY: the author's own books + the reader's notes (per-author namespace).
      const bookKnowledge = authorId != null
        ? await retrieveBookKnowledge(authorId, retrievalQuery)
        : "";

      // SECONDARY: Digital Me chunk retrieval (with S3 full-file fallback).
      const ragContext = ragRows[0]
        ? await retrieveRagContext(authorName, retrievalQuery, ragRows[0].ragFileUrl ?? null)
        : "";

      if (!bookKnowledge && !ragContext) {
        return {
          success: false,
          message: `No knowledge base for ${authorName} yet. Index their books (Super Conversations pipeline) or generate a Digital Me profile in the Admin Console first.`,
          reply: null,
        };
      }

      // Supplementary context: content_items for this author (articles, podcasts, etc.)
      let supplementaryContext = "";
      try {
        if (lastUserMsg && typeof lastUserMsg.content === "string") {
          const contentHits = await semanticSearch({
            query: lastUserMsg.content,
            namespace: "content_items",
            filterAuthor: authorName,
            topK: CONTENT_HITS_PER_TURN,
          });
          if (contentHits.length > 0) {
            supplementaryContext = "\n\n---\nSUPPLEMENTARY CONTENT (articles, podcasts, talks):\n" +
              contentHits.map((h, i) => `[${i + 1}] ${h.snippet}`).join("\n");
            logger.info(`[authorChatbot] Injected ${contentHits.length} content_items hits for "${authorName}"`);
          }
        }
      } catch (err) {
        logger.warn(`[authorChatbot] Content items search failed (non-fatal):`, err);
      }

      // Build system prompt: primary book/notes sources first, then Digital Me
      // chunks, then supplementary content items.
      const combinedContext = [bookKnowledge, ragContext, supplementaryContext]
        .filter(Boolean)
        .join("\n\n");
      const systemPrompt = buildSystemPrompt(authorName, combinedContext);

      // Call LLM
      const response = await invokeLLM({
        model: input.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...input.messages,
        ],
      });

      const content = response?.choices?.[0]?.message?.content;
      const reply = typeof content === "string" ? content : "I'm unable to respond right now. Please try again.";
      logger.info(`[authorChatbot] Chat response for "${authorName}": ${reply.length} chars`);
      return { success: true, reply, authorName };
    }),

  /**
   * Get author info needed to render the chatbot UI.
   */
  getAuthorChatInfo: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const authorName = await canonicalNameFromDb(input.authorName);
      const [profileRow, ragRow] = await Promise.all([
        db
          .select({
            authorName: authorProfiles.authorName,
            bio: authorProfiles.bio,
            s3AvatarUrl: authorProfiles.s3AvatarUrl,
            avatarUrl: authorProfiles.avatarUrl,
          })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, authorName))
          .limit(1),
        db
          .select({
            ragStatus: authorRagProfiles.ragStatus,
            ragVersion: authorRagProfiles.ragVersion,
            ragGeneratedAt: authorRagProfiles.ragGeneratedAt,
            ragWordCount: authorRagProfiles.ragWordCount,
          })
          .from(authorRagProfiles)
          .where(eq(authorRagProfiles.authorName, authorName))
          .limit(1),
      ]);
      if (!profileRow[0]) return null;
      return {
        authorName: profileRow[0].authorName,
        bio: profileRow[0].bio,
        avatarUrl: profileRow[0].s3AvatarUrl ?? profileRow[0].avatarUrl,
        ragStatus: ragRow[0]?.ragStatus ?? "pending",
        ragVersion: ragRow[0]?.ragVersion ?? 0,
        ragGeneratedAt: ragRow[0]?.ragGeneratedAt ?? null,
        ragWordCount: ragRow[0]?.ragWordCount ?? 0,
        isReady: ragRow[0]?.ragStatus === "ready",
      };
    }),

  /**
   * Get the opening message from the author (used when chat is first opened).
   * Uses chunk retrieval for the opening greeting context.
   */
  getOpeningMessage: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      model: z.string().optional().default(DEFAULT_CHAT_MODEL),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const authorName = await canonicalNameFromDb(input.authorName);

      const authorRow = await db
        .select({ id: authorProfiles.id })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, authorName))
        .limit(1);
      const authorId = authorRow[0]?.id ?? null;

      const ragRows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      // For the opening message, retrieve chunks about the author's identity and key ideas
      const openingQuery = `${authorName} identity key ideas books personality introduction`;
      const bookKnowledge = authorId != null
        ? await retrieveBookKnowledge(authorId, openingQuery)
        : "";
      const ragContext = ragRows[0]?.ragFileUrl
        ? await retrieveRagContext(authorName, openingQuery, ragRows[0].ragFileUrl)
        : "";

      if (!bookKnowledge && !ragContext) {
        return { reply: `Hello. I'm ${authorName}. My knowledge base hasn't been built yet — please index my books or generate my Digital Me profile first.` };
      }

      const systemPrompt = buildSystemPrompt(
        authorName,
        [bookKnowledge, ragContext].filter(Boolean).join("\n\n")
      );
      const response = await invokeLLM({
        model: input.model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Introduce yourself briefly (2–3 sentences) in your own voice. Mention one or two of your most important ideas or books. End with an open question that invites the reader to engage.`,
          },
        ],
      });

      const content = response?.choices?.[0]?.message?.content;
      return { reply: typeof content === "string" ? content : `Hello, I'm ${authorName}.` };
    }),
});
