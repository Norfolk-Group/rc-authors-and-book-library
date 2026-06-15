/**
 * bookChatbot.router.ts
 *
 * Book & Author conversational chatbot — powered by the book agent (Opus managed
 * agent) with two host-side retrieval tools:
 *   - retrieve_book_knowledge: book-specific content from the Neon pgvector books
 *     namespace, filtered by stable source_id (survives title changes).
 *   - retrieve_author_knowledge: the author's full body of work across all books
 *     (rag_files + content_items) — because one author may have many books.
 *
 * The agent grounds every answer by calling the appropriate retrieval tool before
 * responding; all DB/Neon access remains host-side.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bookProfiles } from "../../drizzle/schema";
import { ensureBookAgent } from "../services/managedAgents/provision";
import { runConversationTurn } from "../services/managedAgents/runSession";
import { buildBookSystemContext, bookAgentToolHandlers } from "../services/managedAgents/bookAgent";
import { logger } from "../lib/logger";

export const bookChatbotRouter = router({
  /**
   * Send a message to the book chatbot (book + author knowledge agent).
   * On the first turn (no sessionId), a new managed-agents session is created.
   * Pass the returned sessionId on each subsequent turn to maintain context.
   */
  chatV2: protectedProcedure
    .input(z.object({
      bookTitle: z.string().min(1),
      message: z.string().min(1).max(4000),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch book context — only needed when starting a new session.
      let authorName: string | null = null;
      let summary: string | null = null;
      if (!input.sessionId) {
        const [row] = await db
          .select({ authorName: bookProfiles.authorName, summary: bookProfiles.summary })
          .from(bookProfiles)
          .where(eq(bookProfiles.bookTitle, input.bookTitle))
          .limit(1);
        authorName = row?.authorName ?? null;
        summary = row?.summary ?? null;
      }

      const agent = await ensureBookAgent();
      const result = await runConversationTurn({
        agentId: agent.agentId,
        agentVersion: agent.agentVersion,
        environmentId: agent.environmentId,
        sessionId: input.sessionId,
        message: input.message,
        systemContext: input.sessionId
          ? undefined
          : buildBookSystemContext(input.bookTitle, authorName, summary),
        customToolHandlers: bookAgentToolHandlers,
        title: `Chat: "${input.bookTitle}"`,
        timeoutMs: 90_000,
      });

      logger.info(
        `[bookChatbot] chatV2 for "${input.bookTitle}" — ` +
        `${result.toolCalls.length} tool calls, ${result.reply.length} chars, session ${result.sessionId}`
      );
      return {
        success: true,
        sessionId: result.sessionId,
        reply: result.reply,
        toolCalls: result.toolCalls,
        bookTitle: input.bookTitle,
      };
    }),

  /**
   * Get book info needed to render the chatbot UI.
   */
  getBookChatInfo: protectedProcedure
    .input(z.object({ bookTitle: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select({
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          coverImageUrl: bookProfiles.coverImageUrl,
          publishedDate: bookProfiles.publishedDate,
          keyThemes: bookProfiles.keyThemes,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle))
        .limit(1);
      if (!row) return null;
      return {
        bookTitle: row.bookTitle,
        authorName: row.authorName ?? null,
        coverUrl: row.s3CoverUrl ?? row.coverImageUrl ?? null,
        summary: row.summary ?? null,
        publishedDate: row.publishedDate ?? null,
        keyThemes: row.keyThemes ?? null,
        // A book is "ready" if it has a summary (implies it was enriched and indexed).
        isReady: !!row.summary,
      };
    }),
});
