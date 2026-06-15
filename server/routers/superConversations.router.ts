/**
 * superConversations.router.ts
 *
 * tRPC surface for the Super Conversations agents:
 *   - listAgents      → which Book / Author agents exist (authors & books that
 *                       have indexed knowledge in Neon), with their Italian
 *                       persona identities.
 *   - chatBookAgent   → talk to one book's agent (grounded in that book + notes).
 *   - chatAuthorAgent → talk to an author agent (grounded in the whole corpus).
 *   - writeSection    → the Book Writer interviews a chosen roster of agents and
 *                       drafts a section of "Super Conversations" (admin-only;
 *                       it fans out into many model calls).
 *
 * The agents themselves live in server/agents/*. This router only resolves DB
 * ids → participants and shapes the responses for the client.
 */
import { z } from "zod";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getAuthorKnowledgeCounts, getAuthorBookFacets } from "../services/neonVector.service";
import {
  makeBookParticipant,
  makeAuthorParticipant,
  chatWithParticipant,
  runBookWriter,
  type BookParticipant,
  type AuthorParticipant,
  type Participant,
} from "../agents/personas";
import type { AgentIdentity } from "../agents/identity";

const messagesInput = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
  .min(1)
  .max(50);

function identityDTO(id: AgentIdentity) {
  return {
    key: id.key,
    displayName: id.displayName,
    gender: id.gender,
    avatarUrl: id.avatarUrl,
    subjectName: id.subjectName,
  };
}

// ── Super Conversations voice/methodology (steers the Book Writer's prose) ──────
let _styleGuide: string | null | undefined;
async function loadStyleGuide(): Promise<string | undefined> {
  if (_styleGuide !== undefined) return _styleGuide ?? undefined;
  try {
    const p = path.join(process.cwd(), "docs", "super-conversations-voice-and-tone.md");
    _styleGuide = await fsp.readFile(p, "utf8");
  } catch {
    _styleGuide = null;
  }
  return _styleGuide ?? undefined;
}

// ── DB id → participant resolvers ───────────────────────────────────────────────
async function resolveBookParticipant(bookId: number): Promise<BookParticipant | null> {
  const db = await getDb();
  if (!db) return null;
  const [book] = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
    .from(bookProfiles)
    .where(eq(bookProfiles.id, bookId))
    .limit(1);
  if (!book || !book.authorName) return null;
  const [author] = await db
    .select({ id: authorProfiles.id })
    .from(authorProfiles)
    .where(eq(authorProfiles.authorName, book.authorName))
    .limit(1);
  if (!author) return null;
  return makeBookParticipant({
    authorId: author.id,
    bookId: book.id,
    bookTitle: book.bookTitle,
    authorName: book.authorName,
  });
}

async function resolveAuthorParticipant(authorId: number): Promise<AuthorParticipant | null> {
  const db = await getDb();
  if (!db) return null;
  const [author] = await db
    .select({ id: authorProfiles.id, authorName: authorProfiles.authorName })
    .from(authorProfiles)
    .where(eq(authorProfiles.id, authorId))
    .limit(1);
  if (!author) return null;
  return makeAuthorParticipant({ authorId: author.id, authorName: author.authorName });
}

export const superConversationsRouter = router({
  /** List the Book and Author agents backed by indexed knowledge in Neon. */
  listAgents: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { authors: [], books: [] };

    const [counts, facets] = await Promise.all([
      getAuthorKnowledgeCounts(),
      getAuthorBookFacets(),
    ]);
    const authorIds = Object.keys(counts).map(Number).filter((n) => !Number.isNaN(n));
    if (authorIds.length === 0) return { authors: [], books: [] };

    const authorRows = await db
      .select({ id: authorProfiles.id, authorName: authorProfiles.authorName })
      .from(authorProfiles)
      .where(inArray(authorProfiles.id, authorIds));

    const allBookIds = Object.values(facets).flat();
    const bookRows = allBookIds.length
      ? await db
          .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
          .from(bookProfiles)
          .where(inArray(bookProfiles.id, allBookIds))
      : [];
    const bookById = new Map(bookRows.map((b) => [b.id, b]));

    const authors = authorRows.map((a) => {
      const p = makeAuthorParticipant({ authorId: a.id, authorName: a.authorName });
      return { authorId: a.id, vectorCount: counts[a.id] ?? 0, ...identityDTO(p.identity) };
    });

    const books: Array<{ bookId: number; authorId: number } & ReturnType<typeof identityDTO>> = [];
    for (const authorId of authorIds) {
      for (const bookId of facets[authorId] ?? []) {
        const b = bookById.get(bookId);
        if (!b || !b.authorName) continue;
        const p = makeBookParticipant({
          authorId,
          bookId,
          bookTitle: b.bookTitle,
          authorName: b.authorName,
        });
        books.push({ bookId, authorId, ...identityDTO(p.identity) });
      }
    }

    return { authors, books };
  }),

  /** Chat with a single book's agent. */
  chatBookAgent: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive(), messages: messagesInput }))
    .mutation(async ({ input }) => {
      const p = await resolveBookParticipant(input.bookId);
      if (!p) return { success: false as const, message: "No indexed book agent for that id.", reply: null };
      const { text, toolCalls } = await chatWithParticipant(p, input.messages);
      logger.info(`[superConversations] book agent ${p.identity.displayName} replied (${toolCalls} retrievals)`);
      return { success: true as const, reply: text, agent: identityDTO(p.identity) };
    }),

  /** Chat with an author agent (whole-corpus). */
  chatAuthorAgent: protectedProcedure
    .input(z.object({ authorId: z.number().int().positive(), messages: messagesInput }))
    .mutation(async ({ input }) => {
      const p = await resolveAuthorParticipant(input.authorId);
      if (!p) return { success: false as const, message: "No indexed author agent for that id.", reply: null };
      const { text, toolCalls } = await chatWithParticipant(p, input.messages);
      logger.info(`[superConversations] author agent ${p.identity.displayName} replied (${toolCalls} retrievals)`);
      return { success: true as const, reply: text, agent: identityDTO(p.identity) };
    }),

  /**
   * Book Writer: interview a chosen roster of agents and draft a section of
   * "Super Conversations". Admin-only — a single call fans out into many model
   * calls (one agent loop per interview turn).
   */
  writeSection: adminProcedure
    .input(
      z.object({
        brief: z.string().min(1).max(4000),
        bookIds: z.array(z.number().int().positive()).max(20).optional(),
        authorIds: z.array(z.number().int().positive()).max(20).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const roster: Participant[] = [];
      for (const bookId of input.bookIds ?? []) {
        const p = await resolveBookParticipant(bookId);
        if (p) roster.push(p);
      }
      for (const authorId of input.authorIds ?? []) {
        const p = await resolveAuthorParticipant(authorId);
        if (p) roster.push(p);
      }
      if (roster.length === 0) {
        return { success: false as const, message: "Select at least one book or author agent with indexed content.", draft: null };
      }

      const styleGuide = await loadStyleGuide();
      logger.info(`[superConversations] book writer drafting with ${roster.length} interviewees`);
      const { text, toolCalls } = await runBookWriter({ roster, brief: input.brief, styleGuide });
      return {
        success: true as const,
        draft: text,
        interviews: toolCalls,
        roster: roster.map((p) => identityDTO(p.identity)),
      };
    }),
});
