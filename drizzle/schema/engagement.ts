import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// Favorites — tracks user-favorited authors and books for priority refresh scheduling
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner's Manus openId — favorites are per-user */
  userId: varchar("userId", { length: 64 }).notNull(),
  /** 'author' | 'book' */
  entityType: mysqlEnum("entityType", ["author", "book"]).notNull(),
  /** The author name (for authors) or book title (for books) — matches the key used in enrichment */
  entityKey: varchar("entityKey", { length: 512 }).notNull(),
  /** Optional display name for the entity */
  displayName: varchar("displayName", { length: 512 }),
  /** Optional cover/avatar URL for display in Favorites panel */
  imageUrl: varchar("imageUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  /** Composite unique: one favorite per user per entity */
  userEntityIdx: index("favorites_userId_entityType_entityKey_idx").on(table.userId, table.entityType, table.entityKey),
  /** Index for listing all favorites for a user */
  userIdx: index("favorites_userId_idx").on(table.userId),
}));

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// USER INTEREST GRAPH & RAG CONTRAST ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * user_interests — the user's personal interest/topic graph.
 * Each row is a subject, theme, or topic the user is currently focused on.
 * These are cross-referenced against author RAG files to produce alignment scores.
 */
export const userInterests = mysqlTable("user_interests", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner's Manus openId */
  userId: varchar("userId", { length: 64 }).notNull(),
  /** The interest topic name, e.g. "Behavioral Change", "Leadership", "Neuroscience" */
  topic: varchar("topic", { length: 256 }).notNull(),
  /** Optional longer description of what this interest means to the user */
  description: text("description"),
  /** Grouping cluster, e.g. "Leadership", "Science", "Business Strategy" */
  category: varchar("category", { length: 128 }),
  /** Priority weight: low | medium | high | critical */
  weight: mysqlEnum("weight", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  /** Hex color for UI display, e.g. "#3B82F6" */
  color: varchar("color", { length: 7 }).default("#6366F1"),
  /** Display order within category (for drag-to-reorder) */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("user_interests_userId_idx").on(table.userId),
  userCategoryIdx: index("user_interests_userId_category_idx").on(table.userId, table.category),
}));

export type UserInterest = typeof userInterests.$inferSelect;
export type InsertUserInterest = typeof userInterests.$inferInsert;

/**
 * author_interest_scores — alignment scores between authors and user interests.
 * Computed by the RAG Contrast Engine: LLM scores each author's RAG file
 * against each user interest on a 0–10 scale with a one-sentence rationale.
 */
export const authorInterestScores = mysqlTable("author_interest_scores", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull(),
  /** Foreign key → user_interests.id */
  interestId: int("interestId").notNull(),
  /** Owner's Manus openId (denormalized for fast per-user queries) */
  userId: varchar("userId", { length: 64 }).notNull(),
  /** Alignment score 0–10 */
  score: int("score").notNull(),
  /** One-sentence rationale explaining the score */
  rationale: text("rationale"),
  /** LLM model used to compute the score */
  modelUsed: varchar("modelUsed", { length: 128 }),
  /** When the score was computed */
  computedAt: timestamp("computedAt").defaultNow().notNull(),
  /** RAG file version used for scoring */
  ragVersion: int("ragVersion"),
}, (table) => ({
  authorInterestIdx: index("author_interest_scores_author_interest_idx").on(table.authorName, table.interestId),
  userIdx: index("author_interest_scores_userId_idx").on(table.userId),
  scoreIdx: index("author_interest_scores_score_idx").on(table.score),
}));

export type AuthorInterestScore = typeof authorInterestScores.$inferSelect;
export type InsertAuthorInterestScore = typeof authorInterestScores.$inferInsert;

// ── Tags ─────────────────────────────────────────────────────────────────────
/**
 * tags — user-defined labels for organizing authors and books.
 * Tags are displayed as colored pills on cards and can be used for filtering.
 * The tagsJson column on author_profiles and book_profiles caches the applied slugs.
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  /** URL-safe slug, e.g. "must-read", "leadership", "ai-related" */
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  /** Display name, e.g. "Must Read", "Leadership", "AI Related" */
  name: varchar("name", { length: 128 }).notNull(),
  /** Hex color for the tag pill, e.g. "#3B82F6" */
  color: varchar("color", { length: 7 }).notNull().default("#6366F1"),
  /** How many authors + books currently have this tag (denormalized counter) */
  usageCount: int("usageCount").notNull().default(0),
  /** Optional description of what this tag means */
  description: text("description"),
  /** Display order (for drag-to-reorder in tag manager) */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("tags_slug_idx").on(table.slug),
}));

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;
