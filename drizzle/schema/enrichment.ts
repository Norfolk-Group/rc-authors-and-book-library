import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Enrichment schedules — defines recurring enrichment pipelines.
 * Each row represents a pipeline that can be scheduled to run at intervals.
 */
export const enrichmentSchedules = mysqlTable("enrichment_schedules", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique key for this pipeline, e.g. 'enrich-bios', 'scrape-covers', 'social-stats' */
  pipelineKey: varchar("pipelineKey", { length: 128 }).notNull().unique(),
  /** Human-readable label, e.g. 'Enrich Author Bios' */
  label: varchar("label", { length: 256 }).notNull(),
  /** Entity type this pipeline targets: 'author' | 'book' | 'both' */
  entityType: mysqlEnum("entityType", ["author", "book", "both"]).notNull(),
  /** Whether this schedule is currently active */
  enabled: int("enabled").notNull().default(0),
  /** Interval in hours between runs (e.g. 168 = weekly, 720 = monthly) */
  intervalHours: int("intervalHours").notNull().default(168),
  /** Maximum items to process per run (0 = unlimited) */
  batchSize: int("batchSize").notNull().default(10),
  /** Concurrency level for parallel processing */
  concurrency: int("concurrency").notNull().default(2),
  /** When this pipeline was last executed */
  lastRunAt: timestamp("lastRunAt"),
  /** When the next run is scheduled */
  nextRunAt: timestamp("nextRunAt"),
  /** Result of the last run: 'success' | 'partial' | 'failed' */
  lastRunStatus: mysqlEnum("lastRunStatus", ["success", "partial", "failed"]),
  /** Number of items processed in the last run */
  lastRunItemCount: int("lastRunItemCount"),
  /** Duration of the last run in milliseconds */
  lastRunDurationMs: int("lastRunDurationMs"),
  /** Error message from the last run (if any) */
  lastRunError: text("lastRunError"),
  /** Priority: higher = runs first when multiple pipelines are due (1-10) */
  priority: int("priority").notNull().default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EnrichmentSchedule = typeof enrichmentSchedules.$inferSelect;
export type InsertEnrichmentSchedule = typeof enrichmentSchedules.$inferInsert;

/**
 * Enrichment jobs — individual job executions spawned by schedules or manual triggers.
 * Each row represents one run of a pipeline with progress tracking.
 */
export const enrichmentJobs = mysqlTable("enrichment_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to enrichment_schedules.pipelineKey (or 'manual' for ad-hoc runs) */
  pipelineKey: varchar("pipelineKey", { length: 128 }).notNull(),
  /** Job status lifecycle: queued → running → completed/failed/cancelled */
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).notNull().default("queued"),
  /** Who triggered this job: 'schedule' | 'manual' | 'api' */
  triggeredBy: mysqlEnum("triggeredBy", ["schedule", "manual", "api"]).notNull().default("manual"),
  /** Total items to process in this job */
  totalItems: int("totalItems").notNull().default(0),
  /** Items processed so far */
  processedItems: int("processedItems").notNull().default(0),
  /** Items that succeeded */
  succeededItems: int("succeededItems").notNull().default(0),
  /** Items that failed */
  failedItems: int("failedItems").notNull().default(0),
  /** Items that were skipped (already fresh) */
  skippedItems: int("skippedItems").notNull().default(0),
  /** Progress percentage 0-100 */
  progress: int("progress").notNull().default(0),
  /** Human-readable status message */
  message: text("message"),
  /** Error details if failed */
  error: text("error"),
  /** JSON array of individual item results: [{entity, status, error?, durationMs}] */
  itemResultsJson: text("itemResultsJson"),
  /** When the job started executing */
  startedAt: timestamp("startedAt"),
  /** When the job finished (completed, failed, or cancelled) */
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  /** Index for listing jobs by pipeline */
  pipelineIdx: index("enrichment_jobs_pipelineKey_idx").on(table.pipelineKey),
  /** Index for finding running/queued jobs */
  statusIdx: index("enrichment_jobs_status_idx").on(table.status),
}));

export type EnrichmentJob = typeof enrichmentJobs.$inferSelect;
export type InsertEnrichmentJob = typeof enrichmentJobs.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN REVIEW QUEUE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * human_review_queue — items that AI has flagged for human review.
 *
 * The AI pipeline automatically populates this table when it detects:
 *   - Chatbot candidates (authors with sufficient RAG readiness)
 *   - Near-duplicate books/authors (semantic similarity > 0.92)
 *   - Low-confidence author-to-book matches
 *   - Broken or low-quality URLs
 *   - Content items needing classification
 *
 * Admins review items here and take action (approve / reject / merge / skip).
 */
export const humanReviewQueue = mysqlTable("human_review_queue", {
  id: int("id").autoincrement().primaryKey(),
  /**
   * Category of review item:
   *   chatbot_candidate   — author has enough RAG content to enable chatbot
   *   near_duplicate      — two entities are semantically similar (> 0.92)
   *   author_match        — unlinked book/content needs author assignment
   *   url_quality         — URL is broken, redirects, or low-quality
   *   content_classify    — content item needs manual type classification
   *   link_merit          — AI scored a link as low-value; human should verify
   */
  reviewType: mysqlEnum("reviewType", [
    "chatbot_candidate",
    "near_duplicate",
    "author_match",
    "url_quality",
    "content_classify",
    "link_merit",
  ]).notNull(),
  /** Current status of this review item */
  status: mysqlEnum("status", [
    "pending",
    "approved",
    "rejected",
    "merged",
    "skipped",
    "auto_resolved",
  ]).notNull().default("pending"),
  /** Primary entity name (author name, book title, content item title, URL) */
  entityName: varchar("entityName", { length: 512 }).notNull(),
  /** Entity type: 'author' | 'book' | 'content_item' | 'url' */
  entityType: mysqlEnum("entityType", ["author", "book", "content_item", "url"]).notNull(),
  /** Optional secondary entity (for near-duplicate pairs or author-match candidates) */
  secondaryEntityName: varchar("secondaryEntityName", { length: 512 }),
  /** Secondary entity type */
  secondaryEntityType: mysqlEnum("secondaryEntityType", ["author", "book", "content_item", "url"]),
  /**
   * AI confidence score for the flagged issue (0.0–1.0).
   * For near-duplicates: cosine similarity from Neon pgvector.
   * For chatbot candidates: ragReadinessScore / 100.
   * For URL quality: 0 = broken, 0.5 = redirect, 1 = healthy.
   */
  aiConfidence: decimal("aiConfidence", { precision: 4, scale: 3 }),
  /**
   * AI-generated explanation of why this item was flagged.
   * Plain English, 1–3 sentences.
   */
  aiReason: text("aiReason"),
  /**
   * AI-suggested action for the human reviewer.
   */
  aiSuggestedAction: text("aiSuggestedAction"),
  /**
   * Structured metadata specific to the review type.
   * chatbot_candidate: { ragReadinessScore, ragStatus, bioCompleteness, bookCount, contentItemCount }
   * near_duplicate: { similarityScore, namespace, primaryId, secondaryId }
   * author_match: { bookTitle, candidateAuthors: [{ name, confidence }] }
   * url_quality: { url, statusCode, redirectUrl, lastChecked }
   * link_merit: { url, aiScore, aiReason, contentType }
   */
  metadataJson: text("metadataJson"),
  /** Admin notes or comments on this review item */
  adminNotes: text("adminNotes"),
  /** When the admin took action on this item */
  reviewedAt: timestamp("reviewedAt"),
  /** Which pipeline run or trigger created this item */
  sourceJob: varchar("sourceJob", { length: 128 }),
  /** Priority: 1 = highest, 5 = lowest */
  priority: int("priority").notNull().default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  reviewTypeIdx: index("hrq_reviewType_idx").on(table.reviewType),
  statusIdx: index("hrq_status_idx").on(table.status),
  entityNameIdx: index("hrq_entityName_idx").on(table.entityName),
  priorityIdx: index("hrq_priority_idx").on(table.priority),
}));
export type HumanReviewQueueItem = typeof humanReviewQueue.$inferSelect;
export type InsertHumanReviewQueueItem = typeof humanReviewQueue.$inferInsert;
