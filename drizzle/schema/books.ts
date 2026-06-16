import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// Book profiles — enriched via Google Books API, keyed by book title (without author suffix)
export const bookProfiles = mysqlTable("book_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Clean title (before " - "), e.g. "Hidden Potential" */
  bookTitle: varchar("bookTitle", { length: 512 }).notNull().unique(),
  /** Author name extracted from the book entry */
  authorName: varchar("authorName", { length: 256 }),
  /** 2-3 sentence summary of the book */
  summary: text("summary"),
  /** Comma-separated key themes, e.g. "habits,productivity,neuroscience" */
  keyThemes: text("keyThemes"),
  /** Average rating out of 5, e.g. 4.6 — stored as DECIMAL(3,1) for proper numeric sorting */
  rating: decimal("rating", { precision: 3, scale: 1 }),
  /** Number of ratings/reviews as an integer, e.g. 120000 */
  ratingCount: int("ratingCount"),
  /** Amazon product page URL */
  amazonUrl: varchar("amazonUrl", { length: 512 }),
  /** Goodreads book page URL */
  goodreadsUrl: varchar("goodreadsUrl", { length: 512 }),
  /** Wikipedia article URL for this book */
  wikipediaUrl: varchar("wikipediaUrl", { length: 512 }),
  /** Additional resource URL (author's site, podcast, summary, etc.) */
  resourceUrl: varchar("resourceUrl", { length: 512 }),
  /** Label for the resource URL */
  resourceLabel: varchar("resourceLabel", { length: 128 }),
  /** Book cover image URL from Google Books or Apify scrape */
  coverImageUrl: varchar("coverImageUrl", { length: 1024 }),
  /** S3-mirrored cover URL — served from Manus CDN for reliability */
  s3CoverUrl: varchar("s3CoverUrl", { length: 1024 }),
  /** S3 key for the mirrored cover (used for deduplication/cleanup) */
  s3CoverKey: varchar("s3CoverKey", { length: 512 }),
  /** S3 CDN URL for the book PDF (migrated from Dropbox/Drive) */
  s3PdfUrl: varchar("s3PdfUrl", { length: 1024 }),
  /** Published date string, e.g. "2023-04-18" */
  publishedDate: varchar("publishedDate", { length: 32 }),
  /** ISBN-13 */
  isbn: varchar("isbn", { length: 20 }),
  /** Publisher name */
  publisher: varchar("publisher", { length: 256 }),
  /** Publisher's official page for this book */
  publisherUrl: varchar("publisherUrl", { length: 512 }),
  /** When the summary was last enriched by an LLM */
  lastSummaryEnrichedAt: timestamp("lastSummaryEnrichedAt"),
  /** Which LLM/tool generated the summary ('gemini', 'claude', 'openai', 'manual') */
  summaryEnrichmentSource: varchar("summaryEnrichmentSource", { length: 50 }),
  /** Where the cover image came from ('amazon', 'google_books', 'manual') */
  coverImageSource: varchar("coverImageSource", { length: 50 }),
  /**
   * JSON array of all resource links for this book.
   * Shape: [{label: string, url: string, type: 'amazon'|'goodreads'|'wikipedia'|'youtube'|'podcast'|'summary'|'publisher'|'author_site'|'other'}]
   */
  resourceLinksJson: text("resourceLinksJson"),
  /**
   * JSON object with enriched full book summary (double-pass LLM).
   * Shape: {fullSummary: string, keyInsights: string[], quotes: string[], similarBooks: [{title, author, reason}], enrichedAt: string, model: string}
   */
  richSummaryJson: text("richSummaryJson"),
  /**
   * JSON string of TechnicalReferencesResult: code references, GitHub repos,
   * documentation links for technical books.
   * Source: GitHub API + Context7.
   */
  technicalReferencesJson: text("technicalReferencesJson"),
  /** When technicalReferencesJson was last enriched */
  technicalReferencesEnrichedAt: timestamp("technicalReferencesEnrichedAt"),
  /**
   * JSON string of ReadingNote from Notion sync: notes, highlights, status.
   * Source: Notion MCP.
   */
  readingNotesJson: text("readingNotesJson"),
  /** When readingNotesJson was last synced from Notion */
  readingNotesSyncedAt: timestamp("readingNotesSyncedAt"),
  /**
   * Reading progress as a percentage (0–100).
   * Updated manually by the user via the BookDetail page progress slider.
   */
  readingProgressPercent: int("readingProgressPercent"),
  /** Date the user started reading this book (UTC) */
  readingStartedAt: timestamp("readingStartedAt"),
  /** Date the user finished reading this book (UTC) */
  readingFinishedAt: timestamp("readingFinishedAt"),
  /**
   * Personal reading notes JSON.
   * Shape: { notes: string, updatedAt: string }
   */
  personalNotesJson: text("personalNotesJson"),
  enrichedAt: timestamp("enrichedAt"),
  /**
   * Physical/digital format(s) the user owns.
   * - physical: print copy only
   * - digital: ebook/PDF only
   * - audio: audiobook only
   * - physical_digital: print + ebook
   * - physical_audio: print + audiobook
   * - digital_audio: ebook + audiobook
   * - all: all three formats
   * - none: no copy owned (reference/wishlist entry)
   */
  format: mysqlEnum("format", ["physical", "digital", "audio", "physical_digital", "physical_audio", "digital_audio", "all", "none"]),
  /**
   * Possession/reading status for this book.
   * - owned: user owns a copy
   * - wishlist: user wants to acquire it
   * - reference: tracking for research/reference, no ownership intended
   * - borrowed: borrowed from library/friend
   * - gifted: gifted to someone else
   * - read: finished reading
   * - reading: currently reading
   * - unread: owned but not yet read
   */
  possessionStatus: mysqlEnum("possessionStatus", ["owned", "wishlist", "reference", "borrowed", "gifted", "read", "reading", "unread"]),
  /** Google Drive folder ID for this book's folder in 02 — Knowledge Library / 02 — Books by Category */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  /**
   * JSON array of tag slugs applied to this book, e.g. ["must-read", "leadership", "favorite"].
   * Tags are defined in the `tags` table; this column is a denormalized cache for fast filtering.
   */
  tagsJson: text("tagsJson"),

  // ── Library Availability Cache ──────────────────────────────────────────────
  /**
   * Cached Open Library enrichment data.
   * Shape: { olid, title, subjects, firstPublishYear, description, covers, links, cachedAt }
   */
  openLibraryCacheJson: text("openLibraryCacheJson"),
  /** When openLibraryCacheJson was last fetched */
  openLibraryCachedAt: timestamp("openLibraryCachedAt"),
  /**
   * Cached HathiTrust availability data.
   * Shape: { totalItems, fullTextCount, fullTextUrl, rightsCode, cachedAt }
   */
  hathiTrustCacheJson: text("hathiTrustCacheJson"),
  /** When hathiTrustCachedAt was last fetched */
  hathiTrustCachedAt: timestamp("hathiTrustCachedAt"),
  /**
   * Cached WorldCat library availability data.
   * Shape: { totalHoldings, oclcNumber, libraries: [{name, location}], cachedAt }
   */
  worldcatCacheJson: text("worldcatCacheJson"),
  /** When worldcatCacheJson was last fetched */
  worldcatCachedAt: timestamp("worldcatCachedAt"),

  // ── Duplicate Detection ────────────────────────────────────────────────────
  /** ID of the canonical book this is a duplicate of (null = not a duplicate) */
  duplicateOfId: int("duplicateOfId"),
  /** How the duplicate was detected: isbn | fuzzy_title */
  duplicateDetectionMethod: varchar("duplicateDetectionMethod", { length: 32 }),
  /** Review status: pending | keep | discard | replace */
  duplicateStatus: varchar("duplicateStatus", { length: 16 }),
  /** When the duplicate flag was set */
  duplicateFlaggedAt: timestamp("duplicateFlaggedAt"),

  /**
   * JSON array of conversation group slugs this book belongs to.
   * Shape: ["superconversations", ...]
   * "superconversations" is the first group (book knowledge-base agents).
   */
  conversationGroups: text("conversationGroups"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in book enrichment joins) */
  authorNameIdx: index("book_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched books quickly */
  enrichedAtIdx: index("book_profiles_enrichedAt_idx").on(table.enrichedAt),
  /** T1-B: Index for ISBN-based duplicate detection and library cache lookups */
  isbnIdx: index("book_profiles_isbn_idx").on(table.isbn),
  /** T1-B: Index for filtering books by possession status (owned, wishlist, etc.) */
  possessionStatusIdx: index("book_profiles_possessionStatus_idx").on(table.possessionStatus),
  /** T1-B: Index for filtering books by format (PDF, Audio, Physical, etc.) */
  formatIdx: index("book_profiles_format_idx").on(table.format),
}));
export type BookProfile = typeof bookProfiles.$inferSelect;
export type InsertBookProfile = typeof bookProfiles.$inferInsert;
