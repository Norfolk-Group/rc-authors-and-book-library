/**
 * Dropbox Backup Router
 *
 * Provides tRPC procedures for:
 * - Checking Dropbox connection status
 * - Backing up avatars, book covers, and PDFs to Dropbox
 * - Listing backed-up files
 * - Running a full backup of all assets
 *
 * Backup folder: /Cidale Interests/Company/Norfolk AI/Apps/RC Library/
 *   Avatars/      — author headshot images (from author_profiles.s3AvatarUrl)
 *   Book Covers/  — book cover images (from book_profiles.s3CoverUrl)
 *   PDFs/         — PDF files (from content_files where fileType='pdf')
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDropboxAccountInfo,
  uploadFileToDropbox,
  listDropboxFolder,
  listDropboxFolderRecursive,
  dropboxFileExists,
  listDropboxInbox,
  searchDropbox,
  DROPBOX_FOLDERS,
  sanitizeFilename,
  getDropboxAccessToken,
} from "../dropbox.service";
import {
  extractPdfMetadata,
  ingestDropboxFile,
  type IngestFileResult,
} from "../services/dropboxIngest.service";
import crypto from "crypto";
import { getDb } from "../db";
import { authorProfiles, bookProfiles, contentFiles } from "../../drizzle/schema";
import { isNotNull, eq } from "drizzle-orm";
import { parallelBatch } from "../lib/parallelBatch";

export const dropboxRouter = router({
  /** Check if Dropbox is connected and return account info */
  status: protectedProcedure.query(async () => {
    try {
      const account = await getDropboxAccountInfo();
      return {
        connected: true,
        displayName: account.displayName,
        email: account.email,
        backupFolder: DROPBOX_FOLDERS.root,
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Unknown error",
        backupFolder: DROPBOX_FOLDERS.root,
      };
    }
  }),

  /** List files in a specific Dropbox backup folder */
  listFolder: protectedProcedure
    .input(z.object({ folder: z.enum(["avatars", "bookCovers", "pdfs", "root"]) }))
    .query(async ({ input }) => {
      const folderPath = DROPBOX_FOLDERS[input.folder];
      const files = await listDropboxFolder(folderPath);
      return { folder: folderPath, files, count: files.length };
    }),

  /** Backup all author avatars to Dropbox */
  backupAvatars: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const authors = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
        })
        .from(authorProfiles)
        .where(isNotNull(authorProfiles.s3AvatarUrl));

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const author of authors) {
        if (!author.s3AvatarUrl) continue;

        const safeName = sanitizeFilename(author.authorName);
        const ext = author.s3AvatarUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.avatars}/${safeName}.${ext}`;

        try {
          if (input.skipExisting) {
            const exists = await dropboxFileExists(destPath);
            if (exists) {
              skipped++;
              continue;
            }
          }
          await uploadFileToDropbox(author.s3AvatarUrl, destPath, true);
          uploaded++;
        } catch (err) {
          failed++;
          errors.push(`${author.authorName}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return {
        total: authors.length,
        uploaded,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      };
    }),

  /** Backup all book covers to Dropbox */
  backupBookCovers: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const books = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          s3CoverUrl: bookProfiles.s3CoverUrl,
        })
        .from(bookProfiles)
        .where(isNotNull(bookProfiles.s3CoverUrl));

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const book of books) {
        if (!book.s3CoverUrl) continue;

        const safeName = sanitizeFilename(book.bookTitle ?? `book-${book.id}`);
        const ext = book.s3CoverUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.bookCovers}/${safeName}.${ext}`;

        try {
          if (input.skipExisting) {
            const exists = await dropboxFileExists(destPath);
            if (exists) {
              skipped++;
              continue;
            }
          }
          await uploadFileToDropbox(book.s3CoverUrl, destPath, true);
          uploaded++;
        } catch (err) {
          failed++;
          errors.push(`${book.bookTitle}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return {
        total: books.length,
        uploaded,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      };
    }),

  /** Backup all PDF files to Dropbox (from content_files table) */
  backupPdfs: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pdfs = await db
        .select({
          id: contentFiles.id,
          s3Url: contentFiles.s3Url,
          originalFilename: contentFiles.originalFilename,
          cleanFilename: contentFiles.cleanFilename,
          dropboxPath: contentFiles.dropboxPath,
        })
        .from(contentFiles)
        .where(eq(contentFiles.fileType, "pdf"));

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const file of pdfs) {
        if (!file.s3Url) continue;

        const filename = file.cleanFilename ?? file.originalFilename ?? `file-${file.id}.pdf`;
        const safeName = sanitizeFilename(filename.replace(/\.pdf$/i, ""));
        const destPath = `${DROPBOX_FOLDERS.pdfs}/${safeName}.pdf`;

        try {
          if (input.skipExisting) {
            const exists = await dropboxFileExists(destPath);
            if (exists) {
              skipped++;
              continue;
            }
          }
          await uploadFileToDropbox(file.s3Url, destPath, true);
          // Update the dropboxPath in the database
          await db
            .update(contentFiles)
            .set({
              dropboxPath: destPath,
              dropboxSyncedAt: new Date(),
            })
            .where(eq(contentFiles.id, file.id));
          uploaded++;
        } catch (err) {
          failed++;
          errors.push(`${filename}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return {
        total: pdfs.length,
        uploaded,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      };
    }),

  /**
   * Scan the Dropbox Inbox folder and return a list of files.
   * When dryRun=true, also previews the metadata that would be extracted.
   */
  scanInbox: protectedProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .query(async ({ input }) => {
      const files = await listDropboxInbox();
      const previews = await Promise.all(
        files.map(async (f) => {
          if (!f.isPdf) {
            return { ...f, metadata: null, reason: `Skipped: not a PDF (.${f.extension})` };
          }
          const metadata = input.dryRun ? await extractPdfMetadata(f.name) : null;
          return { ...f, metadata, reason: null };
        })
      );
      return {
        inboxFolder: DROPBOX_FOLDERS.inbox,
        processedFolder: DROPBOX_FOLDERS.processed,
        totalFiles: files.length,
        pdfCount: files.filter((f) => f.isPdf).length,
        files: previews,
      };
    }),

  /**
   * Ingest a single file from the Dropbox Inbox.
   * Creates author profiles, book profiles, and uploads the PDF to S3.
   */
  ingestFile: protectedProcedure
    .input(
      z.object({
        dropboxPath: z.string(),
        moveToProcessed: z.boolean().default(true),
        fetchBookCover: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const files = await listDropboxInbox();
      const file = files.find((f) => f.dropboxPath === input.dropboxPath);
      if (!file) throw new Error(`File not found in inbox: ${input.dropboxPath}`);
      return await ingestDropboxFile(file, {
        moveToProcessed: input.moveToProcessed,
        fetchBookCover: input.fetchBookCover,
        dryRun: false,
      });
    }),

  /**
   * Ingest ALL PDF files currently in the Dropbox Inbox.
   * Processes them sequentially to avoid rate limits.
   */
  ingestAll: protectedProcedure
    .input(
      z.object({
        moveToProcessed: z.boolean().default(true),
        fetchBookCover: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const files = await listDropboxInbox();
      const pdfs = files.filter((f) => f.isPdf);
      const results: IngestFileResult[] = [];
      for (const file of pdfs) {
        const result = await ingestDropboxFile(file, {
          moveToProcessed: input.moveToProcessed,
          fetchBookCover: input.fetchBookCover,
          dryRun: false,
        });
        results.push(result);
      }
      const succeeded = results.filter((r) => r.status === "success").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const failed = results.filter((r) => r.status === "error").length;
      return { total: pdfs.length, succeeded, skipped, failed, results };
    }),

  /**
   * Browse a Dropbox folder and return rich file metadata (name, size, modified, extension).
   * Supports both backup subfolders and the inbox.
   */
  browseFolderContents: protectedProcedure
    .input(
      z.object({
        folderPath: z.string(),
        includeSubfolders: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const DROPBOX_API_URL = "https://api.dropboxapi.com/2";
      const token = await getDropboxAccessToken();
      const res = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: input.folderPath, limit: 2000 }),
      });
      if (!res.ok) {
        const text = await res.text();
        // Return empty on path_not_found so UI shows 0 files instead of crashing
        if (res.status === 409) return { folderPath: input.folderPath, files: [], subfolders: [], totalFiles: 0, totalSize: 0, lastModified: null };
        throw new Error(`Dropbox list_folder failed (${res.status}): ${text}`);
      }
      const data = (await res.json()) as {
        entries: Array<{
          ".tag": string;
          name: string;
          path_display: string;
          size?: number;
          server_modified?: string;
          client_modified?: string;
        }>;
      };
      const files = data.entries
        .filter((e) => e[".tag"] === "file")
        .map((e) => ({
          name: e.name,
          path: e.path_display,
          size: e.size ?? 0,
          serverModified: e.server_modified ?? null,
          extension: e.name.split(".").pop()?.toLowerCase() ?? "",
        }))
        .sort((a, b) => (b.serverModified ?? "").localeCompare(a.serverModified ?? ""));
      const subfolders = data.entries
        .filter((e) => e[".tag"] === "folder")
        .map((e) => ({ name: e.name, path: e.path_display }));
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      const lastModified = files[0]?.serverModified ?? null;
      return { folderPath: input.folderPath, files, subfolders, totalFiles: files.length, totalSize, lastModified };
    }),

  /**
   * Get a summary of all backup subfolders (Avatars, Book Covers, PDFs) with file counts,
   * total sizes, and last-modified timestamps. Used for the backup verification dashboard.
   */
  getBackupFolderStats: protectedProcedure.query(async () => {
    const DROPBOX_API_URL = "https://api.dropboxapi.com/2";
    const token = await getDropboxAccessToken();

    async function getFolderStats(folderPath: string) {
      const res = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: folderPath, limit: 2000 }),
      });
      if (!res.ok) return { count: 0, totalSize: 0, lastModified: null, exists: false };
      const data = (await res.json()) as {
        entries: Array<{ ".tag": string; size?: number; server_modified?: string }>;
      };
      const files = data.entries.filter((e) => e[".tag"] === "file");
      const totalSize = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
      const sorted = files
        .filter((f) => f.server_modified)
        .sort((a, b) => (b.server_modified ?? "").localeCompare(a.server_modified ?? ""));
      return {
        count: files.length,
        totalSize,
        lastModified: sorted[0]?.server_modified ?? null,
        exists: true,
      };
    }

    const [avatars, bookCovers, pdfs, inbox] = await Promise.all([
      getFolderStats(DROPBOX_FOLDERS.avatars),
      getFolderStats(DROPBOX_FOLDERS.bookCovers),
      getFolderStats(DROPBOX_FOLDERS.pdfs),
      getFolderStats(DROPBOX_FOLDERS.inbox),
    ]);

    return {
      backupRoot: DROPBOX_FOLDERS.root,
      inboxRoot: DROPBOX_FOLDERS.inbox,
      subfolders: {
        avatars: { path: DROPBOX_FOLDERS.avatars, label: "Avatars", ...avatars },
        bookCovers: { path: DROPBOX_FOLDERS.bookCovers, label: "Book Covers", ...bookCovers },
        pdfs: { path: DROPBOX_FOLDERS.pdfs, label: "PDFs", ...pdfs },
        inbox: { path: DROPBOX_FOLDERS.inbox, label: "Inbox", ...inbox },
      },
    };
  }),

  /** Run a full backup of all assets (avatars + covers + PDFs) */
  backupAll: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Avatars
      const avatarAuthors = await db
        .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, s3AvatarUrl: authorProfiles.s3AvatarUrl })
        .from(authorProfiles)
        .where(isNotNull(authorProfiles.s3AvatarUrl));

      let avatarUploaded = 0, avatarSkipped = 0, avatarFailed = 0;
      for (const author of avatarAuthors) {
        if (!author.s3AvatarUrl) continue;
        const safeName = sanitizeFilename(author.authorName);
        const ext = author.s3AvatarUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.avatars}/${safeName}.${ext}`;
        try {
          if (input.skipExisting && await dropboxFileExists(destPath)) { avatarSkipped++; continue; }
          await uploadFileToDropbox(author.s3AvatarUrl, destPath, true);
          avatarUploaded++;
        } catch { avatarFailed++; }
      }

      // Book Covers
      const coverBooks = await db
        .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, s3CoverUrl: bookProfiles.s3CoverUrl })
        .from(bookProfiles)
        .where(isNotNull(bookProfiles.s3CoverUrl));

      let coverUploaded = 0, coverSkipped = 0, coverFailed = 0;
      for (const book of coverBooks) {
        if (!book.s3CoverUrl) continue;
        const safeName = sanitizeFilename(book.bookTitle ?? `book-${book.id}`);
        const ext = book.s3CoverUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.bookCovers}/${safeName}.${ext}`;
        try {
          if (input.skipExisting && await dropboxFileExists(destPath)) { coverSkipped++; continue; }
          await uploadFileToDropbox(book.s3CoverUrl, destPath, true);
          coverUploaded++;
        } catch { coverFailed++; }
      }

      // PDFs
      const pdfFiles = await db
        .select({ id: contentFiles.id, s3Url: contentFiles.s3Url, originalFilename: contentFiles.originalFilename, cleanFilename: contentFiles.cleanFilename })
        .from(contentFiles)
        .where(eq(contentFiles.fileType, "pdf"));

      let pdfUploaded = 0, pdfSkipped = 0, pdfFailed = 0;
      for (const file of pdfFiles) {
        if (!file.s3Url) continue;
        const filename = file.cleanFilename ?? file.originalFilename ?? `file-${file.id}.pdf`;
        const safeName = sanitizeFilename(filename.replace(/\.pdf$/i, ""));
        const destPath = `${DROPBOX_FOLDERS.pdfs}/${safeName}.pdf`;
        try {
          if (input.skipExisting && await dropboxFileExists(destPath)) { pdfSkipped++; continue; }
          await uploadFileToDropbox(file.s3Url, destPath, true);
          await db.update(contentFiles).set({ dropboxPath: destPath, dropboxSyncedAt: new Date() }).where(eq(contentFiles.id, file.id));
          pdfUploaded++;
        } catch { pdfFailed++; }
      }

      return {
        avatars: { total: avatarAuthors.length, uploaded: avatarUploaded, skipped: avatarSkipped, failed: avatarFailed },
        bookCovers: { total: coverBooks.length, uploaded: coverUploaded, skipped: coverSkipped, failed: coverFailed },
        pdfs: { total: pdfFiles.length, uploaded: pdfUploaded, skipped: pdfSkipped, failed: pdfFailed },
        summary: {
          totalAssets: avatarAuthors.length + coverBooks.length + pdfFiles.length,
          totalUploaded: avatarUploaded + coverUploaded + pdfUploaded,
          totalSkipped: avatarSkipped + coverSkipped + pdfSkipped,
          totalFailed: avatarFailed + coverFailed + pdfFailed,
        },
      };
    }),

  /**
   * Search Dropbox by filename/content for a keyword.
   * Returns up to 100 matches across the entire Dropbox (or scoped to a path).
   */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(200),
      path: z.string().optional().default(""),
    }))
    .mutation(async ({ input }) => {
      const results = await searchDropbox(input.query, input.path);
      return { query: input.query, results, count: results.length };
    }),

  /**
   * Start a bulk recursive folder ingest job.
   * Scans the given Dropbox folder (all subfolders), processes every PDF,
   * uploads to S3, creates book/author records, and optionally indexes text
   * into Neon pgvector. Fires the job asynchronously — returns a jobId
   * immediately. Poll getIngestJob for live progress.
   */
  ingestFolder: protectedProcedure
    .input(z.object({
      folderPath: z.string().min(1),
      moveToProcessed: z.boolean().default(false),
      fetchBookCover: z.boolean().default(true),
      indexToNeon: z.boolean().default(true),
      concurrency: z.number().min(1).max(5).default(2),
    }))
    .mutation(async ({ input }) => {
      const jobId = crypto.randomUUID();
      _ingestJobs.set(jobId, {
        jobId,
        status: "scanning",
        folderPath: input.folderPath,
        total: 0,
        processed: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        neonVectors: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        errors: [],
        errorCount: 0,
        warnings: [],
        warningCount: 0,
      });

      // Move ingested files into a "Processed" subfolder of the SCANNED folder
      // (not the fixed books-inbox) so arbitrary folders don't get their files
      // relocated into an unrelated location.
      const processedFolder = `${input.folderPath}/Processed`;

      // Fire-and-forget
      void (async () => {
        const job = _ingestJobs.get(jobId)!;
        try {
          const allFiles = await listDropboxFolderRecursive(input.folderPath);
          const pdfs = allFiles.filter((f) => f.isPdf);
          job.status = "running";
          job.total = pdfs.length;

          await parallelBatch(pdfs, input.concurrency, async (file) => {
            const res = await ingestDropboxFile(file, {
              moveToProcessed: input.moveToProcessed,
              fetchBookCover: input.fetchBookCover,
              indexToNeon: input.indexToNeon,
              processedFolder,
              dryRun: false,
            });
            job.processed++;
            if (res.status === "success" || res.status === "duplicate") {
              if (res.status === "success") job.succeeded++;
              else job.skipped++;
              job.neonVectors += res.neonVectors ?? 0;
            } else if (res.status === "skipped") {
              job.skipped++;
            } else {
              job.failed++;
              job.errorCount++;
              if (job.errors.length < MAX_JOB_MESSAGES && res.reason) job.errors.push(res.reason);
            }
            if (res.neonIndexError) {
              job.warningCount++;
              if (job.warnings.length < MAX_JOB_MESSAGES) {
                job.warnings.push(`${file.name}: Neon indexing failed — ${res.neonIndexError}`);
              }
            }
            return res;
          });
          job.status = "completed";
        } catch (err) {
          job.status = "failed";
          job.errorCount++;
          if (job.errors.length < MAX_JOB_MESSAGES) job.errors.push(err instanceof Error ? err.message : String(err));
        } finally {
          job.completedAt = new Date().toISOString();
          // Keep job in memory for 24 h then evict
          setTimeout(() => _ingestJobs.delete(jobId), 24 * 60 * 60 * 1000);
        }
      })();

      return { jobId };
    }),

  /** Poll a running or completed ingestFolder job by ID. */
  getIngestJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      return _ingestJobs.get(input.jobId) ?? null;
    }),
});

// ── In-memory job tracker ─────────────────────────────────────────────────────

/** Cap on stored error/warning message strings per job — avoids an unbounded
 * array being retained in memory and re-sent on every 2s poll for large runs. */
const MAX_JOB_MESSAGES = 50;

interface IngestJobState {
  jobId: string;
  status: "scanning" | "running" | "completed" | "failed";
  folderPath: string;
  total: number;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  neonVectors: number;
  startedAt: string;
  completedAt: string | null;
  /** Capped at MAX_JOB_MESSAGES; see errorCount for the true total. */
  errors: string[];
  errorCount: number;
  /** Non-fatal issues (e.g. Neon indexing failed for an otherwise-successful file). */
  warnings: string[];
  warningCount: number;
}

const _ingestJobs = new Map<string, IngestJobState>();
