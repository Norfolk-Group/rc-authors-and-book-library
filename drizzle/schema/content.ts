import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL CONTENT MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * content_items — universal content model for all content types.
 * Replaces the book-only model; books are migrated here as contentType='book'.
 * Every intellectual or creative output by any author is a row in this table.
 */
export const contentItems = mysqlTable("content_items", {
  id: int("id").autoincrement().primaryKey(),
  /** Content type discriminator */
  contentType: mysqlEnum("contentType", [
    "book", "paper", "article", "substack", "newsletter",
    "podcast", "podcast_episode", "youtube_video", "youtube_channel",
    "ted_talk", "masterclass", "online_course", "tv_show", "tv_episode",
    "film", "radio", "photography", "social_post", "speech", "interview",
    "blog_post", "website", "tool", "other"
  ]).notNull(),
  /** Display title */
  title: varchar("title", { length: 512 }).notNull(),
  /** Optional subtitle or episode title */
  subtitle: varchar("subtitle", { length: 512 }),
  /** 2–3 sentence summary */
  description: text("description"),
  /**
   * Full LLM-enriched description.
   * Shape: { fullSummary, keyInsights: string[], notableQuotes: string[], themes: string[], enrichedAt, model }
   */
  richDescriptionJson: text("richDescriptionJson"),
  /** Primary URL (Amazon page, podcast feed, YouTube link, etc.) */
  url: varchar("url", { length: 1024 }),
  /** Thumbnail or cover image URL */
  coverImageUrl: varchar("coverImageUrl", { length: 1024 }),
  /** S3-mirrored cover URL */
  s3CoverUrl: varchar("s3CoverUrl", { length: 1024 }),
  /** S3 key for the mirrored cover */
  s3CoverKey: varchar("s3CoverKey", { length: 512 }),
  /** Publication / release date */
  publishedDate: varchar("publishedDate", { length: 64 }),
  /** JSON string array of tags */
  tagsJson: text("tagsJson"),
  /** Average rating (0.0–5.0) */
  rating: decimal("rating", { precision: 3, scale: 1 }),
  /** Number of ratings */
  ratingCount: int("ratingCount"),
  /** ISO 639-1 language code */
  language: varchar("language", { length: 8 }),
  /**
   * Type-specific metadata stored as JSON.
   * book: { isbn, publisher, amazonUrl, goodreadsUrl, keyThemes }
   * paper: { doi, journal, institution, pdfUrl, citationCount }
   * podcast: { feedUrl, spotifyUrl, appleUrl, episodeCount }
   * youtube_video: { channelId, videoId, viewCount, likeCount }
   * etc.
   */
  metadataJson: text("metadataJson"),
  /** Whether this item is included in the library (shown in UI, synced to Dropbox) */
  includedInLibrary: int("includedInLibrary").notNull().default(1),
  /** Google Drive folder ID (if backed by Drive) */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  /** Personal reading/consumption notes from Notion */
  readingNotesJson: text("readingNotesJson"),
  /** When the record was last enriched */
  enrichedAt: timestamp("enrichedAt"),
  // ── AI Quality Scoring columns (populated by contentIntelligence.service) ──
  /** Composite quality score 0-100 */
  qualityScore: int("qualityScore"),
  /** Relevance score 0-100 */
  relevanceScore: int("relevanceScore"),
  /** Authority score 0-100 */
  authorityScore: int("authorityScore"),
  /** Freshness score 0-100 */
  freshnessScore: int("freshnessScore"),
  /** Depth score 0-100 */
  depthScore: int("depthScore"),
  /** 1 = URL is alive, 0 = dead link */
  isAlive: int("isAlive"),
  /** AI-detected content type (may differ from contentType enum) */
  contentTypeDetected: varchar("contentTypeDetected", { length: 64 }),
  /** When quality scoring was last run */
  qualityScoredAt: timestamp("qualityScoredAt"),
  /** AI-extracted title */
  aiExtractedTitle: varchar("aiExtractedTitle", { length: 512 }),
  /** AI-extracted summary */
  aiExtractedSummary: text("aiExtractedSummary"),
  /** JSON array of key topics */
  aiKeyTopics: text("aiKeyTopics"),
  /** LLM scoring rationale */
  aiScoringRationale: text("aiScoringRationale"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  contentTypeIdx: index("content_items_contentType_idx").on(table.contentType),
  titleIdx: index("content_items_title_idx").on(table.title),
  includedIdx: index("content_items_included_idx").on(table.includedInLibrary),
  qualityScoreIdx: index("content_items_qualityScore_idx").on(table.qualityScore),
  isAliveIdx: index("content_items_isAlive_idx").on(table.isAlive),
  enrichedAtIdx: index("content_items_enrichedAt_idx").on(table.enrichedAt),
}));

export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = typeof contentItems.$inferInsert;

/**
 * author_content_links — M:M join table between authors and content items.
 * An author can have multiple content items; a content item can have multiple authors.
 */
export const authorContentLinks = mysqlTable("author_content_links", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull(),
  /** Foreign key → content_items.id */
  contentItemId: int("contentItemId").notNull(),
  /** Author's role on this content item */
  role: mysqlEnum("role", ["primary", "co-author", "editor", "contributor", "foreword", "narrator"]).notNull().default("primary"),
  /** Display order when listing authors for a content item */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  authorIdx: index("author_content_links_authorName_idx").on(table.authorName),
  contentIdx: index("author_content_links_contentItemId_idx").on(table.contentItemId),
  uniqueLink: index("author_content_links_unique_idx").on(table.authorName, table.contentItemId),
}));

export type AuthorContentLink = typeof authorContentLinks.$inferSelect;
export type InsertAuthorContentLink = typeof authorContentLinks.$inferInsert;

/**
 * content_files — tracks S3-stored files for each content item.
 * One content item can have multiple files (e.g., PDF + MP3 audio).
 */
export const contentFiles = mysqlTable("content_files", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → content_items.id */
  contentItemId: int("contentItemId").notNull(),
  /** S3 object key */
  s3Key: varchar("s3Key", { length: 512 }).notNull().unique(),
  /** CloudFront CDN URL */
  s3Url: varchar("s3Url", { length: 1024 }).notNull(),
  /** Original filename before slug normalization */
  originalFilename: varchar("originalFilename", { length: 512 }),
  /** Clean slug filename used in Dropbox/Drive mirror */
  cleanFilename: varchar("cleanFilename", { length: 512 }),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),
  /** File size in bytes */
  fileSizeBytes: int("fileSizeBytes"),
  /** MD5 checksum for deduplication */
  md5Checksum: varchar("md5Checksum", { length: 32 }),
  /** File type category */
  fileType: mysqlEnum("fileType", ["pdf", "mp3", "mp4", "epub", "doc", "transcript", "image", "json", "other"]).notNull().default("pdf"),
  /** Dropbox path where this file was last mirrored */
  dropboxPath: varchar("dropboxPath", { length: 1024 }),
  /** When this file was last mirrored to Dropbox */
  dropboxSyncedAt: timestamp("dropboxSyncedAt"),
  /** Google Drive file ID where this file was last mirrored */
  driveFileId: varchar("driveFileId", { length: 128 }),
  /** When this file was last mirrored to Google Drive */
  driveSyncedAt: timestamp("driveSyncedAt"),
  // ── Duplicate Detection ────────────────────────────────────────────────────
  /** SHA-256 hash of the file content (for exact duplicate detection) */
  contentHash: varchar("contentHash", { length: 64 }),
  /** ID of the canonical file this is a duplicate of (null = not a duplicate) */
  duplicateOfId: int("duplicateOfId"),
  /** How the duplicate was detected: hash | filename */
  duplicateDetectionMethod: varchar("duplicateDetectionMethod", { length: 32 }),
  /** Review status: pending | keep | discard | replace */
  duplicateStatus: varchar("duplicateStatus", { length: 16 }),
  /** When the duplicate flag was set */
  duplicateFlaggedAt: timestamp("duplicateFlaggedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  contentItemIdx: index("content_files_contentItemId_idx").on(table.contentItemId),
  fileTypeIdx: index("content_files_fileType_idx").on(table.fileType),
}));

export type ContentFile = typeof contentFiles.$inferSelect;
export type InsertContentFile = typeof contentFiles.$inferInsert;

/**
 * ingest_sources — tracks where each content item originated.
 * Enables traceability from S3 file back to its original source.
 */
export const ingestSources = mysqlTable("ingest_sources", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → content_items.id */
  contentItemId: int("contentItemId").notNull(),
  /** Source type */
  sourceType: mysqlEnum("sourceType", [
    "dropbox", "google_drive", "manual_upload", "scrape",
    "api", "dropbox_mirror", "drive_mirror"
  ]).notNull(),
  /** Source path or URL (e.g., Dropbox path, Drive folder ID, scrape URL) */
  sourcePath: varchar("sourcePath", { length: 1024 }),
  /** When this source was last synced */
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  contentItemIdx: index("ingest_sources_contentItemId_idx").on(table.contentItemId),
}));

export type IngestSource = typeof ingestSources.$inferSelect;
export type InsertIngestSource = typeof ingestSources.$inferInsert;

// ── Magazine Articles ────────────────────────────────────────────────────────
// Unified cache for articles from 5 publications:
//   the-atlantic | the-new-yorker | wired | nyt | washington-post
// Articles are matched to library authors by normalised author name.
export const magazineArticles = mysqlTable("magazine_articles", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable ID: "{source}-{url-slug}" */
  articleId: varchar("articleId", { length: 192 }).notNull().unique(),
  /** Publication source key */
  source: mysqlEnum("source", ["the-atlantic", "the-new-yorker", "wired", "nyt", "washington-post"]).notNull(),
  /** Human-readable publication name */
  publicationName: varchar("publicationName", { length: 128 }).notNull(),
  /** Article headline */
  title: text("title").notNull(),
  /** Canonical article URL */
  url: varchar("url", { length: 1024 }).notNull(),
  /** Author name as returned by the RSS feed */
  authorName: varchar("authorName", { length: 256 }),
  /** Normalised author name for matching against library author profiles */
  authorNameNormalized: varchar("authorNameNormalized", { length: 256 }),
  /** ISO-8601 publish date */
  publishedAt: timestamp("publishedAt"),
  /** Short teaser text from RSS (up to 600 chars) */
  summaryText: text("summaryText"),
  /** Full article body text scraped via Apify (null until scraped) */
  fullText: text("fullText"),
  /** JSON array of category/tag strings */
  categoriesJson: text("categoriesJson"),
  /** Which RSS feed URL this article came from */
  feedUrl: varchar("feedUrl", { length: 512 }),
  /** When the full text was last scraped via Apify */
  scrapedAt: timestamp("scrapedAt"),
  /** Whether full-text scraping has been attempted */
  scrapeAttempted: boolean("scrapeAttempted").notNull().default(false),
  /** Whether this article has been indexed in Neon pgvector for RAG */
  ragIndexed: boolean("ragIndexed").notNull().default(false),
  /** When this article was indexed in Neon pgvector */
  ragIndexedAt: timestamp("ragIndexedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  authorIdx: index("mag_author_idx").on(table.authorNameNormalized),
  sourceIdx: index("mag_source_idx").on(table.source),
  publishedIdx: index("mag_published_idx").on(table.publishedAt),
  articleIdIdx: index("mag_article_id_idx").on(table.articleId),
  ragIdx: index("mag_rag_idx").on(table.ragIndexed),
}));
export type MagazineArticleRow = typeof magazineArticles.$inferSelect;
export type InsertMagazineArticle = typeof magazineArticles.$inferInsert;
