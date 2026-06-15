/**
 * superConversations.router.ts
 *
 * Writing studio for "Super Conversations" — Ricardo Cidale's book about
 * transforming B2B sales through curiosity, active listening, and AI agent training.
 *
 * The SC Writer agent (Sonnet) has two host-side interview tools:
 *   - interview_author: opens a single-turn session with the author agent (Opus)
 *     and returns a grounded answer in that author's documented voice.
 *   - interview_book: opens a single-turn session with the book agent (Opus)
 *     and returns a grounded answer from the book's documented content.
 *
 * Each interview is a one-shot turn — the Writer asks a focused question and
 * gets a grounded answer it can weave into the prose.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import {
  ensureSuperConversationsAgent,
  ensureAuthorAgent,
  ensureBookAgent,
} from "../services/managedAgents/provision";
import { runConversationTurn, type CustomToolHandler } from "../services/managedAgents/runSession";
import {
  buildAuthorSystemContext,
  authorAgentToolHandlers,
} from "../services/managedAgents/authorAgent";
import {
  buildBookSystemContext,
  bookAgentToolHandlers,
} from "../services/managedAgents/bookAgent";
import { logger } from "../lib/logger";

/** Build the host-side handler for interview_author. */
async function makeInterviewAuthorHandler(): Promise<CustomToolHandler> {
  const agent = await ensureAuthorAgent();
  return async (input) => {
    const authorName = String(input.authorName ?? "").trim();
    const question = String(input.question ?? "").trim();
    if (!authorName || !question) return "Author name and question are required.";

    const db = await getDb();
    let bio: string | null = null;
    if (db) {
      const [row] = await db
        .select({ bio: authorProfiles.bio })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, authorName))
        .limit(1);
      bio = row?.bio ?? null;
    }

    try {
      const result = await runConversationTurn({
        agentId: agent.agentId,
        agentVersion: agent.agentVersion,
        environmentId: agent.environmentId,
        message: question,
        systemContext: buildAuthorSystemContext(authorName, bio),
        customToolHandlers: authorAgentToolHandlers,
        title: `Writer interview: ${authorName}`,
        timeoutMs: 60_000,
      });
      logger.info(`[superConversations] interview_author: "${authorName}" → ${result.reply.length} chars`);
      return result.reply || `${authorName} did not provide a response.`;
    } catch (err) {
      logger.warn(`[superConversations] interview_author failed for "${authorName}":`, err);
      return `Could not retrieve a grounded response from ${authorName}. Proceed without this reference.`;
    }
  };
}

/** Build the host-side handler for interview_book. */
async function makeInterviewBookHandler(): Promise<CustomToolHandler> {
  const agent = await ensureBookAgent();
  return async (input) => {
    const bookTitle = String(input.bookTitle ?? "").trim();
    const question = String(input.question ?? "").trim();
    if (!bookTitle || !question) return "Book title and question are required.";

    const db = await getDb();
    let authorName: string | null = null;
    let summary: string | null = null;
    if (db) {
      const [row] = await db
        .select({ authorName: bookProfiles.authorName, summary: bookProfiles.summary })
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, bookTitle))
        .limit(1);
      authorName = row?.authorName ?? null;
      summary = row?.summary ?? null;
    }

    try {
      const result = await runConversationTurn({
        agentId: agent.agentId,
        agentVersion: agent.agentVersion,
        environmentId: agent.environmentId,
        message: question,
        systemContext: buildBookSystemContext(bookTitle, authorName, summary),
        customToolHandlers: bookAgentToolHandlers,
        title: `Writer interview: "${bookTitle}"`,
        timeoutMs: 60_000,
      });
      logger.info(`[superConversations] interview_book: "${bookTitle}" → ${result.reply.length} chars`);
      return result.reply || `"${bookTitle}" did not provide a response.`;
    } catch (err) {
      logger.warn(`[superConversations] interview_book failed for "${bookTitle}":`, err);
      return `Could not retrieve a grounded response from "${bookTitle}". Proceed without this reference.`;
    }
  };
}

export const superConversationsRouter = router({
  /**
   * Send a message to the ghostwriter agent and receive a prose reply.
   * On the first turn (no sessionId), a new session is created.
   * On subsequent turns, pass back the sessionId to maintain writing context.
   *
   * The Writer agent may call interview_author or interview_book internally;
   * those are resolved host-side before the prose reply is returned.
   */
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(8000),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Provision all three agents in parallel — fast no-op when already provisioned.
      const [agent, interviewAuthor, interviewBook] = await Promise.all([
        ensureSuperConversationsAgent(),
        makeInterviewAuthorHandler(),
        makeInterviewBookHandler(),
      ]);

      const result = await runConversationTurn({
        agentId: agent.agentId,
        agentVersion: agent.agentVersion,
        environmentId: agent.environmentId,
        sessionId: input.sessionId,
        message: input.message,
        customToolHandlers: {
          interview_author: interviewAuthor,
          interview_book: interviewBook,
        },
        title: "Super Conversations — Writing Session",
        // Extended timeout: each interview sub-turn can take up to 60s;
        // allow for up to two interviews plus writing time.
        timeoutMs: 180_000,
      });

      logger.info(
        `[superConversations] Writing turn complete (${result.reply.length} chars, ` +
        `tools: [${result.toolCalls.join(", ")}], session ${result.sessionId})`
      );
      return {
        sessionId: result.sessionId,
        reply: result.reply,
        toolCalls: result.toolCalls,
      };
    }),
});
