/**
 * Drizzle schema barrel.
 *
 * Table definitions are organized into domain files under `drizzle/schema/`.
 * This file re-exports all of them so that:
 *   - every existing `import { ... } from ".../drizzle/schema"` keeps working, and
 *   - drizzle-kit (configured with `schema: "./drizzle/schema.ts"`) discovers
 *     every table through the re-exports.
 *
 * Domain files:
 *   core.ts        — users, adminActionLog, appSettings, apiRegistry
 *   authors.ts     — authorProfiles, authorRagProfiles, authorSubscriptions, authorAliases
 *   books.ts       — bookProfiles
 *   content.ts     — contentItems, authorContentLinks, contentFiles, ingestSources, magazineArticles
 *   enrichment.ts  — enrichmentSchedules, enrichmentJobs, humanReviewQueue
 *   engagement.ts  — favorites, userInterests, authorInterestScores, tags
 *   media.ts          — dropboxFolderConfigs, smartUploads
 *   sync.ts           — syncStatus, syncJobs
 *   managedAgents.ts  — managedAgents
 */

export * from "./schema/core";
export * from "./schema/authors";
export * from "./schema/books";
export * from "./schema/content";
export * from "./schema/enrichment";
export * from "./schema/engagement";
export * from "./schema/media";
export * from "./schema/sync";
export * from "./schema/managedAgents";
