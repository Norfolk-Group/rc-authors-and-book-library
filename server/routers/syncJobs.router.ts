/**
 * syncJobs.router.ts
 *
 * S3-to-Dropbox / S3-to-Google-Drive one-way sync engine.
 *
 * Architecture:
 *   - All files (PDFs, audio, avatars, RAG files) are stored in S3 (source of truth)
 *   - This router pushes them to Dropbox and/or Google Drive in author-based folder structure
 *   - Folder structure: /{AuthorName}/{content-type}/{filename}
 *   - Jobs are tracked in the sync_jobs table
 *   - Idempotent: files already present at target are skipped (by key hash)
 *
 * Dropbox integration:
 *   - Files ≤ 150 MB: simple /files/upload
 *   - Files > 150 MB (audio): streaming upload session (no full buffering)
 *
 * Google Drive integration:
 *   - Uses resumable upload API for all file sizes
 *   - Access token via GOOGLE_DRIVE_ACCESS_TOKEN env var or gws CLI (sandbox)
 *   - Folder structure mirrors Dropbox: /{AuthorName}/{content-type}/{filename}
 *
 * _metadata.json sidecar:
 *   - Generated per book folder with title, author, ISBN, rating, summary, S3 URL
 *   - Uploaded alongside the book cover in /{AuthorName}/books/{bookSlug}/_metadata.json
 *
 * Credentials required (set via Admin → Settings or webdev_request_secrets):
 *   - DROPBOX_ACCESS_TOKEN (long-lived or refreshable)
 *   - GOOGLE_DRIVE_ACCESS_TOKEN (optional; falls back to gws CLI in sandbox)
 *   - GOOGLE_DRIVE_PARENT_FOLDER_ID (target folder in Drive)
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { syncJobs, authorProfiles, bookProfiles, authorRagProfiles } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getDropboxToken, getDropboxConnectionStatus } from "../dropboxAuth";
import {
  uploadToDropbox,
  uploadToDrive,
  getOrCreateDriveFolder,
  getDriveAccessToken,
  uploadMetadataSidecarToDropbox,
  uploadMetadataSidecarToDrive,
  generateBookMetadata,
  slugify,
} from "../syncEngine";

// ── Router ────────────────────────────────────────────────────────────────────
export const syncJobsRouter = router({
  /**
   * List recent sync jobs
   */
  listJobs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const jobs = await db
        .select()
        .from(syncJobs)
        .orderBy(desc(syncJobs.createdAt))
        .limit(input?.limit ?? 20);
      return jobs;
    }),

  /**
   * Get a specific sync job by ID
   */
  getJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(syncJobs).where(eq(syncJobs.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Trigger a sync job
   * - target: "dropbox" | "google_drive" | "both"
   * - scope: "all" or comma-separated author names
   * - contentTypes: which content types to sync
   * - generateSidecars: whether to generate _metadata.json sidecars for books
   */
  triggerSync: publicProcedure
    .input(
      z.object({
        target: z.enum(["dropbox", "google_drive", "both"]),
        scope: z.string().default("all"),
        contentTypes: z
          .array(z.enum(["avatars", "books", "audio", "rag_files"]))
          .default(["avatars", "books", "audio", "rag_files"]),
        overwrite: z.boolean().default(false),
        generateSidecars: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };

      // Check credentials
      let dropboxToken: string | null = null;
      if (input.target === "dropbox" || input.target === "both") {
        try { dropboxToken = await getDropboxToken(); } catch { dropboxToken = null; }
      }
      const driveParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
      let driveToken: string | null = null;
      if (input.target === "google_drive" || input.target === "both") {
        driveToken = await getDriveAccessToken();
      }

      if ((input.target === "dropbox" || input.target === "both") && !dropboxToken) {
        return { success: false, message: "Dropbox is not connected. Please connect via Admin → Sync → Connect Dropbox." };
      }
      if ((input.target === "google_drive" || input.target === "both") && (!driveToken || !driveParentId)) {
        return {
          success: false,
          message: !driveParentId
            ? "GOOGLE_DRIVE_PARENT_FOLDER_ID not configured. Add it in Admin → Settings."
            : "Google Drive access token not available. Set GOOGLE_DRIVE_ACCESS_TOKEN in secrets or ensure gws CLI is authenticated.",
        };
      }

      // Create job record
      const [jobResult] = await db.insert(syncJobs).values({
        target: input.target,
        status: "running",
        triggeredBy: "manual",
        scope: input.scope,
        startedAt: new Date(),
      });
      const jobId = (jobResult as unknown as { insertId: number }).insertId;

      // Run sync asynchronously (fire and forget — status tracked in DB)
      runSyncJob(jobId, {
        ...input,
        dropboxToken: dropboxToken ?? "",
        driveToken: driveToken ?? "",
        driveParentId: driveParentId ?? "",
      }).catch(async (err) => {
        const db2 = await getDb();
        if (!db2) return;
        await db2.update(syncJobs).set({
          status: "failed",
          error: String(err),
          completedAt: new Date(),
        }).where(eq(syncJobs.id, jobId));
      });

      return { success: true, jobId };
    }),

  /**
   * Cancel a running sync job
   */
  cancelJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(syncJobs).set({ status: "cancelled", completedAt: new Date() }).where(eq(syncJobs.id, input.id));
      return { success: true };
    }),

  /**
   * Get Dropbox connection status (OAuth 2 refresh token flow).
   */
  getDropboxStatus: publicProcedure
    .query(async () => {
      return await getDropboxConnectionStatus();
    }),

  /**
   * Get Google Drive connection status.
   */
  getDriveStatus: publicProcedure
    .query(async () => {
      const token = await getDriveAccessToken();
      const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
      return {
        connected: !!(token && parentId),
        hasAccessToken: !!token,
        hasParentFolderId: !!parentId,
        parentFolderId: parentId ?? null,
      };
    }),

  /**
   * Generate _metadata.json sidecars for all books without uploading other files.
   * Useful for updating metadata after enrichment runs.
   */
  generateSidecars: publicProcedure
    .input(
      z.object({
        target: z.enum(["dropbox", "google_drive", "both"]),
        scope: z.string().default("all"),
        overwrite: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };

      let dropboxToken: string | null = null;
      if (input.target === "dropbox" || input.target === "both") {
        try { dropboxToken = await getDropboxToken(); } catch { dropboxToken = null; }
      }
      const driveParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
      let driveToken: string | null = null;
      if (input.target === "google_drive" || input.target === "both") {
        driveToken = await getDriveAccessToken();
      }

      if ((input.target === "dropbox" || input.target === "both") && !dropboxToken) {
        return { success: false, message: "Dropbox not connected." };
      }
      if ((input.target === "google_drive" || input.target === "both") && (!driveToken || !driveParentId)) {
        return { success: false, message: "Google Drive not configured." };
      }

      // Fetch all books
      let authorFilter: string[] | null = null;
      if (input.scope !== "all") {
        authorFilter = input.scope.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const books = await db.select().from(bookProfiles);
      let synced = 0;
      let failed = 0;

      for (const book of books) {
        const bookAuthor = book.authorName ?? "Unknown";
        if (authorFilter && !authorFilter.includes(bookAuthor)) continue;

        const authorSlug = slugify(bookAuthor);
        const bookSlug = slugify(book.bookTitle ?? "book");
        const metadata = generateBookMetadata({
          bookTitle: book.bookTitle ?? "Unknown",
          authorName: book.authorName,
          isbn: book.isbn,
          rating: book.rating,
          ratingCount: book.ratingCount,
          summary: book.summary,
          s3CoverUrl: book.s3CoverUrl,
          amazonUrl: book.amazonUrl,
          goodreadsUrl: book.goodreadsUrl,
          wikipediaUrl: book.wikipediaUrl,
          publishedDate: book.publishedDate,
          format: book.format,
          possessionStatus: book.possessionStatus,
          keyThemesJson: null,
        });

        if (input.target === "dropbox" || input.target === "both") {
          const result = await uploadMetadataSidecarToDropbox(
            dropboxToken!,
            authorSlug,
            bookSlug,
            metadata,
            input.overwrite
          );
          if (result.success) synced++; else failed++;
        }

        if (input.target === "google_drive" || input.target === "both") {
          // Create author/books folder structure in Drive
          const authorFolderId = await getOrCreateDriveFolder(driveToken!, driveParentId!, authorSlug);
          if (authorFolderId) {
            const booksFolderId = await getOrCreateDriveFolder(driveToken!, authorFolderId, "books");
            if (booksFolderId) {
              const bookFolderId = await getOrCreateDriveFolder(driveToken!, booksFolderId, bookSlug);
              if (bookFolderId) {
                const result = await uploadMetadataSidecarToDrive(driveToken!, bookFolderId, metadata);
                if (result.success) synced++; else failed++;
              }
            }
          }
        }
      }

      return { success: true, synced, failed };
    }),
});

// ── Async sync runner ─────────────────────────────────────────────────────────
interface SyncJobInput {
  target: "dropbox" | "google_drive" | "both";
  scope: string;
  contentTypes: string[];
  overwrite: boolean;
  generateSidecars: boolean;
  dropboxToken: string;
  driveToken: string;
  driveParentId: string;
}

interface SyncFile {
  authorName: string;
  contentType: "avatars" | "books" | "audio" | "rag_files";
  s3Url: string;
  fileName: string;
  mimeType: string;
  /** For books: full book record for sidecar generation */
  bookRecord?: typeof bookProfiles.$inferSelect;
}

async function runSyncJob(jobId: number, input: SyncJobInput) {
  const db = await getDb();
  if (!db) return;

  // Determine which authors to include
  let authorFilter: string[] | null = null;
  if (input.scope !== "all") {
    authorFilter = input.scope.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const files: SyncFile[] = [];

  // ── Collect files ──────────────────────────────────────────────────────────

  // Avatars
  if (input.contentTypes.includes("avatars")) {
    const rows = await db
      .select({ authorName: authorProfiles.authorName, s3AvatarUrl: authorProfiles.s3AvatarUrl })
      .from(authorProfiles);
    for (const row of rows) {
      if (!row.s3AvatarUrl) continue;
      if (authorFilter && !authorFilter.includes(row.authorName)) continue;
      files.push({
        authorName: row.authorName,
        contentType: "avatars",
        s3Url: row.s3AvatarUrl,
        fileName: `${slugify(row.authorName)}_avatar.jpg`,
        mimeType: "image/jpeg",
      });
    }
  }

  // Books (covers + optional metadata sidecars)
  if (input.contentTypes.includes("books")) {
    const rows = await db.select().from(bookProfiles);
    for (const row of rows) {
      if (!row.s3CoverUrl) continue;
      const bookAuthor = row.authorName ?? "Unknown";
      if (authorFilter && !authorFilter.includes(bookAuthor)) continue;
      files.push({
        authorName: bookAuthor,
        contentType: "books",
        s3Url: row.s3CoverUrl,
        fileName: `${slugify(row.bookTitle ?? "book")}_cover.jpg`,
        mimeType: "image/jpeg",
        bookRecord: row,
      });
    }
  }

  // Audio (RAG audio files, podcasts — large files that need streaming)
  if (input.contentTypes.includes("audio")) {
    // Audio files are stored in content_items — fetch those with audio content types
    // For now, also check authorRagProfiles for any audio URLs
    const rows = await db
      .select({
        authorName: authorRagProfiles.authorName,
        ragFileUrl: authorRagProfiles.ragFileUrl,
        ragVersion: authorRagProfiles.ragVersion,
      })
      .from(authorRagProfiles);
    for (const row of rows) {
      if (!row.ragFileUrl) continue;
      if (authorFilter && !authorFilter.includes(row.authorName)) continue;
      // Only include audio files (not markdown RAG files)
      if (!/\.(mp3|m4a|m4b|ogg|flac|wav|aac|opus)$/i.test(row.ragFileUrl)) continue;
      files.push({
        authorName: row.authorName,
        contentType: "audio",
        s3Url: row.ragFileUrl,
        fileName: `${slugify(row.authorName)}_audio_v${row.ragVersion ?? 1}.mp3`,
        mimeType: "audio/mpeg",
      });
    }
  }

  // RAG files (markdown)
  if (input.contentTypes.includes("rag_files")) {
    const rows = await db
      .select({
        authorName: authorRagProfiles.authorName,
        ragFileUrl: authorRagProfiles.ragFileUrl,
        ragVersion: authorRagProfiles.ragVersion,
      })
      .from(authorRagProfiles);
    for (const row of rows) {
      if (!row.ragFileUrl) continue;
      if (authorFilter && !authorFilter.includes(row.authorName)) continue;
      // Only include markdown RAG files (not audio)
      if (/\.(mp3|m4a|m4b|ogg|flac|wav|aac|opus)$/i.test(row.ragFileUrl)) continue;
      files.push({
        authorName: row.authorName,
        contentType: "rag_files",
        s3Url: row.ragFileUrl,
        fileName: `${slugify(row.authorName)}_digital_me_v${row.ragVersion ?? 1}.md`,
        mimeType: "text/markdown",
      });
    }
  }

  // Update total count
  await db.update(syncJobs).set({ totalFiles: files.length }).where(eq(syncJobs.id, jobId));

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;
  const fileResults: { s3Url: string; targetPath: string; status: string; error?: string; bytes?: number }[] = [];

  // ── Drive folder cache (avoid repeated API calls for the same author) ───────
  const driveFolderCache = new Map<string, string>(); // "authorSlug/contentType" → folderId

  async function getDriveFolderId(authorSlug: string, contentType: string): Promise<string | null> {
    const cacheKey = `${authorSlug}/${contentType}`;
    if (driveFolderCache.has(cacheKey)) return driveFolderCache.get(cacheKey)!;
    const authorFolderId = await getOrCreateDriveFolder(input.driveToken, input.driveParentId, authorSlug);
    if (!authorFolderId) return null;
    const typeFolderId = await getOrCreateDriveFolder(input.driveToken, authorFolderId, contentType);
    if (typeFolderId) driveFolderCache.set(cacheKey, typeFolderId);
    return typeFolderId;
  }

  // ── Process files ──────────────────────────────────────────────────────────

  for (const file of files) {
    // Check if job was cancelled
    const jobRows = await db.select({ status: syncJobs.status }).from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);
    if (jobRows[0]?.status === "cancelled") break;

    const authorSlug = slugify(file.authorName ?? "unknown");
    const targetPath = `/${authorSlug}/${file.contentType}/${file.fileName}`;

    // ── Dropbox upload ─────────────────────────────────────────────────────
    if (input.target === "dropbox" || input.target === "both") {
      const result = await uploadToDropbox(
        input.dropboxToken,
        targetPath,
        file.s3Url,
        input.overwrite
      );
      if (result.success) {
        synced++;
        bytes += result.bytes ?? 0;
        fileResults.push({ s3Url: file.s3Url, targetPath, status: "synced", bytes: result.bytes });

        // Generate _metadata.json sidecar for books
        if (file.contentType === "books" && input.generateSidecars && file.bookRecord) {
          const bookSlug = slugify(file.bookRecord.bookTitle ?? "book");
          const metadata = generateBookMetadata({
            bookTitle: file.bookRecord.bookTitle ?? "Unknown",
            authorName: file.bookRecord.authorName,
            isbn: file.bookRecord.isbn,
            rating: file.bookRecord.rating,
            ratingCount: file.bookRecord.ratingCount,
            summary: file.bookRecord.summary,
            s3CoverUrl: file.bookRecord.s3CoverUrl,
            amazonUrl: file.bookRecord.amazonUrl,
            goodreadsUrl: file.bookRecord.goodreadsUrl,
            wikipediaUrl: file.bookRecord.wikipediaUrl,
            publishedDate: file.bookRecord.publishedDate,
            format: file.bookRecord.format,
            possessionStatus: file.bookRecord.possessionStatus,
            keyThemesJson: null,
          });
          await uploadMetadataSidecarToDropbox(input.dropboxToken, authorSlug, bookSlug, metadata, true);
        }
      } else {
        failed++;
        fileResults.push({ s3Url: file.s3Url, targetPath, status: "failed", error: result.error });
      }
    }

    // ── Google Drive upload ────────────────────────────────────────────────
    if (input.target === "google_drive" || input.target === "both") {
      const folderId = await getDriveFolderId(authorSlug, file.contentType);
      if (!folderId) {
        if (input.target === "google_drive") failed++;
        fileResults.push({ s3Url: file.s3Url, targetPath: `Drive/${targetPath}`, status: "failed", error: "Could not create Drive folder" });
      } else {
        const result = await uploadToDrive(
          input.driveToken,
          folderId,
          file.fileName,
          file.s3Url,
          file.mimeType
        );
        if (result.success) {
          if (input.target === "google_drive") synced++;
          bytes += result.bytes ?? 0;
          fileResults.push({ s3Url: file.s3Url, targetPath: `Drive/${targetPath}`, status: "synced", bytes: result.bytes });

          // Generate _metadata.json sidecar for books in Drive
          if (file.contentType === "books" && input.generateSidecars && file.bookRecord) {
            const bookSlug = slugify(file.bookRecord.bookTitle ?? "book");
            const bookFolderId = await getDriveFolderId(authorSlug, `books/${bookSlug}`);
            if (bookFolderId) {
              const metadata = generateBookMetadata({
                bookTitle: file.bookRecord.bookTitle ?? "Unknown",
                authorName: file.bookRecord.authorName,
                isbn: file.bookRecord.isbn,
                rating: file.bookRecord.rating,
                ratingCount: file.bookRecord.ratingCount,
                summary: file.bookRecord.summary,
                s3CoverUrl: file.bookRecord.s3CoverUrl,
                amazonUrl: file.bookRecord.amazonUrl,
                goodreadsUrl: file.bookRecord.goodreadsUrl,
                wikipediaUrl: file.bookRecord.wikipediaUrl,
                publishedDate: file.bookRecord.publishedDate,
                format: file.bookRecord.format,
                possessionStatus: file.bookRecord.possessionStatus,
                keyThemesJson: null,
              });
              await uploadMetadataSidecarToDrive(input.driveToken, bookFolderId, metadata);
            }
          }
        } else {
          if (input.target === "google_drive") failed++;
          fileResults.push({ s3Url: file.s3Url, targetPath: `Drive/${targetPath}`, status: "failed", error: result.error });
        }
      }
    }

    // Update progress every 5 files
    if ((synced + failed + skipped) % 5 === 0) {
      await db.update(syncJobs).set({
        syncedFiles: synced,
        failedFiles: failed,
        skippedFiles: skipped,
        bytesTransferred: bytes,
        message: `Syncing… ${synced + failed + skipped}/${files.length} files`,
      }).where(eq(syncJobs.id, jobId));
    }
  }

  // Final update
  await db.update(syncJobs).set({
    status: failed > 0 && synced === 0 ? "failed" : "completed",
    syncedFiles: synced,
    failedFiles: failed,
    skippedFiles: skipped,
    bytesTransferred: bytes,
    message: `Completed: ${synced} synced, ${failed} failed, ${skipped} skipped`,
    fileResultsJson: JSON.stringify(fileResults.slice(0, 500)),
    completedAt: new Date(),
  }).where(eq(syncJobs.id, jobId));
}
