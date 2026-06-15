import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// Sync status — tracks background Drive scan jobs
export const syncStatus = mysqlTable("sync_status", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  /** Job type: 'drive-scan' | 'mirror-covers' | 'mirror-avatars' */
  jobType: varchar("jobType", { length: 64 }).notNull().default("drive-scan"),
  /** Enrichment type for enrichment jobs: 'youtube' | 'ted' | 'substack' | 'bios' | 'covers' | etc. */
  enrichmentType: varchar("enrichmentType", { length: 64 }),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).notNull().default("pending"),
  /** 0-100 progress percentage */
  progress: int("progress").notNull().default(0),
  totalItems: int("totalItems"),
  processedItems: int("processedItems").notNull().default(0),
  /** Summary message shown to user */
  message: text("message"),
  /** Error message if failed */
  error: text("error"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type SyncStatus = typeof syncStatus.$inferSelect;
export type InsertSyncStatus = typeof syncStatus.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// S3-TO-DROPBOX/DRIVE SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sync_jobs — tracks each S3-to-Dropbox/Drive sync run.
 */
export const syncJobs = mysqlTable("sync_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** Target platform */
  target: mysqlEnum("target", ["dropbox", "google_drive", "both"]).notNull(),
  /** Job status */
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).notNull().default("pending"),
  /** How the job was triggered */
  triggeredBy: mysqlEnum("triggeredBy", ["manual", "schedule", "api"]).notNull().default("manual"),
  /** Scope: 'all' or comma-separated author names */
  scope: varchar("scope", { length: 1024 }).notNull().default("all"),
  /** Total files to sync */
  totalFiles: int("totalFiles").notNull().default(0),
  /** Files successfully synced */
  syncedFiles: int("syncedFiles").notNull().default(0),
  /** Files skipped (already current) */
  skippedFiles: int("skippedFiles").notNull().default(0),
  /** Files that failed */
  failedFiles: int("failedFiles").notNull().default(0),
  /** Total bytes transferred */
  bytesTransferred: int("bytesTransferred").notNull().default(0),
  /** Human-readable status message */
  message: text("message"),
  /** Error details */
  error: text("error"),
  /** JSON array of per-file results: [{s3Key, targetPath, status, error?, bytes}] */
  fileResultsJson: text("fileResultsJson"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("sync_jobs_status_idx").on(table.status),
  targetIdx: index("sync_jobs_target_idx").on(table.target),
}));

export type SyncJob = typeof syncJobs.$inferSelect;
export type InsertSyncJob = typeof syncJobs.$inferInsert;
