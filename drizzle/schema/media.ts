import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// ── Dropbox Folder Configuration ─────────────────────────────────────────────
/**
 * dropbox_folder_configs — stores all Dropbox folder connections used by the app.
 * Admins can view, edit, enable/disable each folder from the admin UI.
 */
export const dropboxFolderConfigs = mysqlTable("dropbox_folder_configs", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique machine key, e.g. 'backup_root', 'books_inbox', 'authors_inbox' */
  folderKey: varchar("folderKey", { length: 64 }).notNull().unique(),
  /** Human-readable label shown in the admin UI */
  label: varchar("label", { length: 128 }).notNull(),
  /** Short description of what this folder is used for */
  description: text("description"),
  /** Absolute Dropbox API path, e.g. /Apps NAI/RC Library App Data/Authors and Books Backup */
  dropboxPath: varchar("dropboxPath", { length: 1024 }).notNull(),
  /** Dropbox web URL for direct browser access */
  dropboxWebUrl: varchar("dropboxWebUrl", { length: 2048 }),
  /** Category: backup | inbox | source | design | other */
  category: mysqlEnum("category_dfc", ["backup", "inbox", "source", "design", "other"]).notNull().default("other"),
  /** Whether this folder connection is active and used by the app */
  enabled: boolean("enabled").notNull().default(true),
  /** Last time the path was validated against the Dropbox API */
  lastValidatedAt: timestamp("lastValidatedAt"),
  /** Result of last validation: valid | invalid | unchecked */
  validationStatus: mysqlEnum("validationStatus_dfc", ["valid", "invalid", "unchecked"]).notNull().default("unchecked"),
  /** Error message from last validation if invalid */
  validationError: text("validationError"),
  /** Sort order for display */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt_dfc").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt_dfc").defaultNow().onUpdateNow().notNull(),
});
export type DropboxFolderConfig = typeof dropboxFolderConfigs.$inferSelect;
export type InsertDropboxFolderConfig = typeof dropboxFolderConfigs.$inferInsert;

// ── Smart Upload Jobs ─────────────────────────────────────────────────────────
/**
 * smart_uploads — tracks every file uploaded through the Smart Upload system.
 * The AI classifier analyses each file and populates the classification fields.
 * Admin can review, override, and commit the classification to the DB.
 */
export const smartUploads = mysqlTable("smart_uploads", {
  id: int("id").autoincrement().primaryKey(),
  /** Original filename from the user's file picker */
  originalFilename: varchar("originalFilename", { length: 512 }).notNull(),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  /** File size in bytes */
  fileSizeBytes: int("fileSizeBytes").notNull(),
  /** S3 staging key (before final placement) */
  stagingS3Key: varchar("stagingS3Key", { length: 512 }),
  /** S3 staging URL */
  stagingS3Url: varchar("stagingS3Url", { length: 1024 }),
  /** Final S3 key after commit */
  finalS3Key: varchar("finalS3Key", { length: 512 }),
  /** Final S3 URL after commit */
  finalS3Url: varchar("finalS3Url", { length: 1024 }),
  // ── AI Classification ──────────────────────────────────────────────────────
  /** Overall upload status */
  status: mysqlEnum("status_su", ["pending", "classifying", "review", "committed", "rejected", "error"]).notNull().default("pending"),
  /** AI-detected content type */
  aiContentType: mysqlEnum("aiContentType", ["book_pdf", "book_audio", "book_cover", "author_avatar", "author_bio", "article_pdf", "podcast_audio", "video", "research_paper", "newsletter", "transcript", "design_asset", "unknown"]),
  /** AI confidence score 0-100 */
  aiConfidence: int("aiConfidence"),
  /** AI reasoning text */
  aiReasoning: text("aiReasoning"),
  /** Full AI classification JSON */
  aiClassificationJson: text("aiClassificationJson"),
  /** AI-suggested author name */
  aiSuggestedAuthorName: varchar("aiSuggestedAuthorName", { length: 256 }),
  /** Matched author ID (after fuzzy match) */
  matchedAuthorId: int("matchedAuthorId"),
  /** AI-suggested book title */
  aiSuggestedBookTitle: varchar("aiSuggestedBookTitle", { length: 512 }),
  /** Matched book ID (after fuzzy match) */
  matchedBookId: int("matchedBookId"),
  /** Target DB table for this file */
  targetTable: varchar("targetTable", { length: 64 }),
  /** Whether to index in Neon pgvector */
  shouldIndexNeon: boolean("shouldIndexNeon").default(false),
  /** Neon namespace to use */
  neonNamespace: varchar("neonNamespace", { length: 64 }),
  /** Whether to mirror to Dropbox */
  shouldMirrorDropbox: boolean("shouldMirrorDropbox").default(true),
  /** Suggested Dropbox destination path */
  suggestedDropboxPath: varchar("suggestedDropboxPath", { length: 1024 }),
  // ── Admin Override ─────────────────────────────────────────────────────────
  /** Admin-overridden content type (if different from AI) */
  overrideContentType: varchar("overrideContentType", { length: 64 }),
  /** Admin-confirmed author ID */
  confirmedAuthorId: int("confirmedAuthorId"),
  /** Admin-confirmed book ID */
  confirmedBookId: int("confirmedBookId"),
  /** Admin notes */
  adminNotes: text("adminNotes"),
  // ── Commit Result ──────────────────────────────────────────────────────────
  /** ID of the created/updated record in the target table */
  committedRecordId: int("committedRecordId"),
  /** Error message if status=error */
  errorMessage: text("errorMessage"),
  /** When AI classification completed */
  classifiedAt: timestamp("classifiedAt"),
  /** When admin committed or rejected */
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt_su").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt_su").defaultNow().onUpdateNow().notNull(),
});
export type SmartUpload = typeof smartUploads.$inferSelect;
export type InsertSmartUpload = typeof smartUploads.$inferInsert;
