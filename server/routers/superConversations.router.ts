/**
 * superConversations.router.ts
 *
 * Writing studio for "Super Conversations" — Ricardo Cidale's book about
 * transforming B2B sales through curiosity, active listening, and AI agent training.
 *
 * Uses the Super Conversations ghostwriter managed agent (Sonnet) for stateful,
 * multi-turn writing sessions. Pass the returned `sessionId` on each subsequent
 * turn to continue the same writing session.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { ensureSuperConversationsAgent } from "../services/managedAgents/provision";
import { runConversationTurn } from "../services/managedAgents/runSession";
import { logger } from "../lib/logger";

export const superConversationsRouter = router({
  /**
   * Send a message to the ghostwriter agent and receive a prose reply.
   * On the first turn (no sessionId), a new session is created.
   * On subsequent turns, pass back the sessionId to maintain writing context.
   */
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(8000),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const agent = await ensureSuperConversationsAgent();
      const result = await runConversationTurn({
        agentId: agent.agentId,
        agentVersion: agent.agentVersion,
        environmentId: agent.environmentId,
        sessionId: input.sessionId,
        message: input.message,
        title: "Super Conversations — Writing Session",
      });

      logger.info(`[superConversations] Writing turn complete (${result.reply.length} chars, session ${result.sessionId})`);
      return {
        sessionId: result.sessionId,
        reply: result.reply,
      };
    }),
});
