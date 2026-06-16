import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Admin action log — tracks when each admin action was last run
export const adminActionLog = mysqlTable("admin_action_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Action key, e.g. 'regenerate_db', 'enrich_bios', 'scrape_covers' */
  actionKey: varchar("actionKey", { length: 128 }).notNull().unique(),
  /** Human-readable label */
  label: varchar("label", { length: 256 }),
  /** Last run timestamp */
  lastRunAt: timestamp("lastRunAt"),
  /** Duration of last run in ms */
  lastRunDurationMs: int("lastRunDurationMs"),
  /** Result: success or error message */
  lastRunResult: text("lastRunResult"),
  /** How many items were processed */
  lastRunItemCount: int("lastRunItemCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminActionLog = typeof adminActionLog.$inferSelect;
export type InsertAdminActionLog = typeof adminActionLog.$inferInsert;

// ── App Settings ─────────────────────────────────────────────────────────────
/**
 * Generic key-value store for application settings.
 * Used for: Dropbox refresh token, Google Drive folder ID, AI model preferences, etc.
 */
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ── API Registry ─────────────────────────────────────────────────────────────
/**
 * api_registry — catalog of all external APIs used in the application.
 * Tracks name, source, status, and whether each API is enabled.
 * Admins can toggle APIs on/off and check their live status.
 */
export const apiRegistry = mysqlTable("api_registry", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique machine key, e.g. 'rapidapi-twitter', 'open-library' */
  apiKey: varchar("apiKey", { length: 128 }).notNull().unique(),
  /** Human-readable name, e.g. 'Twitter / X API' */
  name: varchar("name", { length: 256 }).notNull(),
  /** Short description of what this API provides */
  description: text("description"),
  /** Category grouping: 'books' | 'news' | 'social' | 'finance' | 'travel' | 'utilities' | 'ai' | 'other' */
  category: mysqlEnum("category", ["books", "news", "social", "finance", "travel", "utilities", "ai", "other"]).notNull().default("other"),
  /** Where this API was sourced from, e.g. 'RapidAPI', 'Open Library', 'iTunes', 'Internal' */
  source: varchar("source", { length: 128 }).notNull(),
  /** URL to the API listing or documentation page */
  sourceUrl: varchar("sourceUrl", { length: 512 }),
  /** RapidAPI host header value, e.g. 'twitter-api45.p.rapidapi.com' (null for non-RapidAPI) */
  rapidApiHost: varchar("rapidApiHost", { length: 256 }),
  /** A sample endpoint URL used for health checks */
  healthCheckUrl: varchar("healthCheckUrl", { length: 512 }),
  /** Whether this API is enabled for use in the app */
  enabled: int("enabled").notNull().default(1),
  /** Last known status: 'green' = working, 'yellow' = subscribed but issues, 'red' = down/not subscribed */
  statusColor: mysqlEnum("statusColor", ["green", "yellow", "red"]).notNull().default("yellow"),
  /** HTTP status code from last health check */
  lastStatusCode: int("lastStatusCode"),
  /** Human-readable result of last health check */
  lastStatusMessage: varchar("lastStatusMessage", { length: 512 }),
  /** When the last health check was run */
  lastCheckedAt: timestamp("lastCheckedAt"),
  /** Optional admin notes */
  notes: text("notes"),
  /** Display order within category */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("api_registry_category_idx").on(table.category),
  enabledIdx: index("api_registry_enabled_idx").on(table.enabled),
}));

export type ApiRegistry = typeof apiRegistry.$inferSelect;
export type InsertApiRegistry = typeof apiRegistry.$inferInsert;
