/**
 * participantResolvers.ts — DB id → Super Conversations participant helpers.
 *
 * Resolves book/author ids to the participant objects the agent runtime needs,
 * plus small shared helpers (identity DTO shaping, the voice/methodology guide
 * loader). Kept out of the tRPC router so that file stays focused on procedures.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  makeBookParticipant,
  makeAuthorParticipant,
  type BookParticipant,
  type AuthorParticipant,
} from "./personas";
import type { AgentIdentity } from "./identity";

/** Client-facing shape of an agent identity (no internal-only fields). */
export function identityDTO(id: AgentIdentity) {
  return {
    key: id.key,
    displayName: id.displayName,
    gender: id.gender,
    avatarUrl: id.avatarUrl,
    subjectName: id.subjectName,
  };
}

export async function resolveBookParticipant(bookId: number): Promise<BookParticipant | null> {
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

export async function resolveAuthorParticipant(authorId: number): Promise<AuthorParticipant | null> {
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

// Super Conversations voice/methodology (steers the Book Writer's prose). Read
// once and cached; absent file → undefined (the writer still works without it).
let _styleGuide: string | null | undefined;
export async function loadStyleGuide(): Promise<string | undefined> {
  if (_styleGuide !== undefined) return _styleGuide ?? undefined;
  try {
    const p = path.join(process.cwd(), "docs", "super-conversations-voice-and-tone.md");
    _styleGuide = await fsp.readFile(p, "utf8");
  } catch {
    _styleGuide = null;
  }
  return _styleGuide ?? undefined;
}
