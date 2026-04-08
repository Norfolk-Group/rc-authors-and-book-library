/**
 * Smart Upload Router
 *
 * Handles the lifecycle of AI-classified file uploads:
 * 1. list — paginated list of upload jobs
 * 2. getById — single upload job details
 * 3. classify — re-run AI classification on an existing upload
 * 4. updateOverride — admin overrides AI classification
 * 5. commit — commit a reviewed upload to the target DB table + Pinecone
 * 6. reject — mark an upload as rejected
 * 7. delete — remove a staging upload
 * 8. stats — summary counts by status
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { smartUploads, authorProfiles, bookProfiles } from "../../drizzle/schema";
import { eq, desc, count, and, isNull, isNotNull, sql } from "drizzle-orm";
import { classifyFile, enrichClassificationWithDbMatches } from "../services/aiFileClassifier.service";
import { storagePut } from "../storage";

// ── Router ────────────────────────────────────────────────────────────────────

export const smartUploadRouter = router({
  /** List all uploads with pagination */
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "classifying", "review", "committed", "rejected", "error", "all"])
          .optional()
          .default("all"),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions =
        input.status !== "all" ? [eq(smartUploads.status, input.status as any)] : [];

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(smartUploads)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(smartUploads.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: count() })
          .from(smartUploads)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items: rows,
        total: totalResult[0]?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /** Get a single upload by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db
        .select()
        .from(smartUploads)
        .where(eq(smartUploads.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Stats: counts by status */
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const rows = await db
      .select({
        status: smartUploads.status,
        count: count(),
      })
      .from(smartUploads)
      .groupBy(smartUploads.status);

    const result: Record<string, number> = {
      pending: 0,
      classifying: 0,
      review: 0,
      committed: 0,
      rejected: 0,
      error: 0,
    };
    for (const row of rows) {
      if (row.status) result[row.status] = row.count;
    }
    result.total = Object.values(result).reduce((a, b) => a + b, 0);
    return result;
  }),

  /** Re-run AI classification on an existing upload */
  classify: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(smartUploads)
        .where(eq(smartUploads.id, input.id))
        .limit(1);
      const upload = rows[0];
      if (!upload) throw new Error("Upload not found");

      // Set status to classifying
      await db
        .update(smartUploads)
        .set({ status: "classifying" })
        .where(eq(smartUploads.id, input.id));

      try {
        const classification = await classifyFile({
          filename: upload.originalFilename,
          mimeType: upload.mimeType,
          fileSizeBytes: upload.fileSizeBytes,
        });

        const { matchedAuthorId, matchedBookId } =
          await enrichClassificationWithDbMatches(classification);

        await db
          .update(smartUploads)
          .set({
            status: "review",
            aiContentType: classification.contentType as any,
            aiConfidence: classification.confidence,
            aiReasoning: classification.reasoning,
            aiClassificationJson: JSON.stringify(classification),
            aiSuggestedAuthorName: classification.suggestedAuthorName,
            aiSuggestedBookTitle: classification.suggestedBookTitle,
            matchedAuthorId,
            matchedBookId,
            targetTable: classification.targetTable,
            shouldIndexPinecone: classification.shouldIndexPinecone,
            pineconeNamespace: classification.pineconeNamespace,
            shouldMirrorDropbox: true,
            suggestedDropboxPath: classification.suggestedDropboxPath,
            classifiedAt: new Date(),
          })
          .where(eq(smartUploads.id, input.id));

        return { success: true, classification };
      } catch (err) {
        await db
          .update(smartUploads)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Classification failed",
          })
          .where(eq(smartUploads.id, input.id));
        throw err;
      }
    }),

  /** Admin override of AI classification */
  updateOverride: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        overrideContentType: z.string().optional(),
        confirmedAuthorId: z.number().nullable().optional(),
        confirmedBookId: z.number().nullable().optional(),
        shouldIndexPinecone: z.boolean().optional(),
        pineconeNamespace: z.string().nullable().optional(),
        shouldMirrorDropbox: z.boolean().optional(),
        suggestedDropboxPath: z.string().nullable().optional(),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updates } = input;
      await db
        .update(smartUploads)
        .set(updates as any)
        .where(eq(smartUploads.id, id));

      return { success: true };
    }),

  /** Commit a reviewed upload to the target DB + Pinecone */
  commit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(smartUploads)
        .where(eq(smartUploads.id, input.id))
        .limit(1);
      const upload = rows[0];
      if (!upload) throw new Error("Upload not found");
      if (upload.status !== "review") throw new Error("Upload must be in review status to commit");

      // Determine effective values (override takes precedence over AI)
      const contentType = upload.overrideContentType ?? upload.aiContentType;
      const authorId = upload.confirmedAuthorId ?? upload.matchedAuthorId;
      const bookId = upload.confirmedBookId ?? upload.matchedBookId;

      let committedRecordId: number | null = null;

      try {
        // Route to the correct DB table based on content type
        switch (contentType) {
          case "author_avatar": {
            if (!authorId) throw new Error("Author ID required for avatar upload");
            if (!upload.finalS3Url) throw new Error("No S3 URL available for avatar");
            await db
              .update(authorProfiles)
              .set({
                s3AvatarUrl: upload.finalS3Url,
                s3AvatarKey: upload.finalS3Key ?? undefined,
                avatarSource: "drive" as any,
              })
              .where(eq(authorProfiles.id, authorId));
            committedRecordId = authorId;
            break;
          }
          case "book_cover": {
            if (!bookId) throw new Error("Book ID required for cover upload");
            if (!upload.finalS3Url) throw new Error("No S3 URL available for cover");
            await db
              .update(bookProfiles)
              .set({ coverImageUrl: upload.finalS3Url } as any)
              .where(eq(bookProfiles.id, bookId));
            committedRecordId = bookId;
            break;
          }
          default:
            // For other types, just mark as committed — full DB routing is handled by future pipeline
            committedRecordId = upload.id;
        }

        await db
          .update(smartUploads)
          .set({
            status: "committed",
            committedRecordId,
            reviewedAt: new Date(),
          })
          .where(eq(smartUploads.id, input.id));

        return { success: true, committedRecordId };
      } catch (err) {
        await db
          .update(smartUploads)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Commit failed",
          })
          .where(eq(smartUploads.id, input.id));
        throw err;
      }
    }),

  /** Reject an upload */
  reject: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(smartUploads)
        .set({
          status: "rejected",
          adminNotes: input.reason,
          reviewedAt: new Date(),
        })
        .where(eq(smartUploads.id, input.id));
      return { success: true };
    }),

  /** Delete an upload record */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(smartUploads).where(eq(smartUploads.id, input.id));
      return { success: true };
    }),

  /** List all authors for the override dropdowns */
  listAuthors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: authorProfiles.id, name: authorProfiles.authorName })
      .from(authorProfiles)
      .orderBy(authorProfiles.authorName)
      .limit(300);
  }),

  /** List all books for the override dropdowns */
  listBooks: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: bookProfiles.id, title: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
      .from(bookProfiles)
      .orderBy(bookProfiles.bookTitle)
      .limit(500);
  }),
});
