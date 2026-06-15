import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// Author profiles — enriched via Wikipedia/Wikidata, keyed by author base name
export const authorProfiles = mysqlTable("author_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Base name (before " - "), e.g. "Adam Grant" */
  authorName: varchar("authorName", { length: 256 }).notNull().unique(),
  bio: text("bio"),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  twitterUrl: varchar("twitterUrl", { length: 512 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  /** Real author avatar URL sourced from Wikipedia or publisher pages via Apify */
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  /** Source URL where the avatar was found */
  avatarSourceUrl: varchar("avatarSourceUrl", { length: 1024 }),
  /** S3-mirrored avatar URL — served from Manus CDN for reliability */
  s3AvatarUrl: varchar("s3AvatarUrl", { length: 1024 }),
  /** S3 key for the mirrored avatar (used for deduplication/cleanup) */
  s3AvatarKey: varchar("s3AvatarKey", { length: 512 }),
  /** Which tier of the enrichment waterfall provided the avatar:
   * - wikipedia: Wikipedia REST API (Tier 1)
   * - tavily: Tavily image search (Tier 2)
   * - apify: Apify web scrape (Tier 3)
   * - ai: Replicate AI-generated avatar (Tier 5 fallback)
   * - google-imagen: Google Imagen / Nano Banana AI-generated
   * - drive: Manually uploaded via Google Drive reseed
   */
  avatarSource: mysqlEnum("avatarSource", ["wikipedia", "tavily", "apify", "ai", "google-imagen", "drive"]),
  /**
   * Cached structured JSON from the Research LLM stage.
   * Stores AuthorDescription — physical appearance, style, personality.
   * Avoids re-research on avatar regeneration.
   */
  authorDescriptionJson: text("authorDescriptionJson"),
  /** When the authorDescriptionJson was last generated */
  authorDescriptionCachedAt: timestamp("authorDescriptionCachedAt"),
  /**
   * The exact image generation prompt used to create the current avatar.
   * Stored for debugging, auditing, and prompt-only regeneration.
   */
  lastAvatarPrompt: text("lastAvatarPrompt"),
  /** When the lastAvatarPrompt was built */
  lastAvatarPromptBuiltAt: timestamp("lastAvatarPromptBuiltAt"),
  /** Google Drive file ID for the generated/uploaded avatar */
  driveAvatarFileId: varchar("driveAvatarFileId", { length: 255 }),
  /** Which vendor generated the current AI avatar (google, replicate, openai, stability) */
  avatarGenVendor: varchar("avatarGenVendor", { length: 50 }),
  /** Which model generated the current AI avatar (e.g. nano-banana, flux-schnell) */
  avatarGenModel: varchar("avatarGenModel", { length: 100 }),
  /** Which vendor was used for the research LLM stage of the meticulous pipeline (e.g. google, anthropic) */
  avatarResearchVendor: varchar("avatarResearchVendor", { length: 50 }),
  /** Which model was used for the research LLM stage (e.g. gemini-2.5-flash, claude-3-5-sonnet) */
  avatarResearchModel: varchar("avatarResearchModel", { length: 100 }),
  /**
   * The best reference photo URL used during the meticulous pipeline research stage.
   * Sourced from Tavily image search, Wikipedia, or official author website.
   * Stored for transparency, auditing, and display alongside the generated portrait.
   */
  bestReferencePhotoUrl: varchar("bestReferencePhotoUrl", { length: 1024 }),
  /** Author's podcast URL (e.g. Spotify, Apple Podcasts, own feed) */
  podcastUrl: varchar("podcastUrl", { length: 512 }),
  /** Author's personal blog URL */
  blogUrl: varchar("blogUrl", { length: 512 }),
  /** Author's Substack newsletter URL */
  substackUrl: varchar("substackUrl", { length: 512 }),
  /** Author's Medium profile URL (e.g. medium.com/@authorname) */
  mediumUrl: varchar("mediumUrl", { length: 512 }),
  /** Number of posts published on Substack (from public /api/v1/publication endpoint) */
  substackPostCount: int("substackPostCount"),
  /** Subscriber range label from Substack (e.g. '10K-50K', '50K-100K') */
  substackSubscriberRange: varchar("substackSubscriberRange", { length: 50 }),
  /** ISO timestamp of last Substack stats fetch */
  substackStatsEnrichedAt: timestamp("substackStatsEnrichedAt"),
  /**
   * JSON object storing social stats per platform.
   * Shape: {
   *   github?: { followers, publicRepos, totalStars, fetchedAt },
   *   substack?: { postCount, subscriberRange, fetchedAt },
   *   youtube?: { subscriberCount, videoCount, viewCount, channelId, fetchedAt },
   *   twitter?: { followerCount, fetchedAt },
   *   linkedin?: { followerCount, fetchedAt },
   *   instagram?: { followerCount, fetchedAt },
   *   tiktok?: { followerCount, likeCount, fetchedAt },
   *   facebook?: { fanCount, fetchedAt },
   * }
   */
  socialStatsJson: text("socialStatsJson"),
  /** When social stats were last fetched across all platforms */
  socialStatsEnrichedAt: timestamp("socialStatsEnrichedAt"),
  /** Author's YouTube channel URL */
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  /** Author's Facebook page URL */
  facebookUrl: varchar("facebookUrl", { length: 512 }),
  /** Author's Instagram profile URL */
  instagramUrl: varchar("instagramUrl", { length: 512 }),
  /** Author's TikTok profile URL */
  tiktokUrl: varchar("tiktokUrl", { length: 512 }),
  /** Author's GitHub profile URL */
  githubUrl: varchar("githubUrl", { length: 512 }),
  /** Author's business or company website URL */
  businessWebsiteUrl: varchar("businessWebsiteUrl", { length: 512 }),
  /** Author's email newsletter URL (Mailchimp, ConvertKit, Beehiiv, etc.) */
  newsletterUrl: varchar("newsletterUrl", { length: 512 }),
  /** Author's speaking bureau or booking page URL */
  speakingUrl: varchar("speakingUrl", { length: 512 }),
  /** Stock ticker symbol for author-linked public company (e.g. 'AAPL' for Tim Cook) */
  stockTicker: varchar("stockTicker", { length: 20 }),
  /** Wikipedia article URL for this author */
  wikipediaUrl: varchar("wikipediaUrl", { length: 512 }),
  /** JSON array of newspaper/online article links: [{title, url, date, publication}] */
  newspaperArticlesJson: text("newspaperArticlesJson"),
  /** JSON array of other links: [{label, url, type}] */
  otherLinksJson: text("otherLinksJson"),
  /** When the links were last enriched via Perplexity/Tavily */
  lastLinksEnrichedAt: timestamp("lastLinksEnrichedAt"),
  /** Which tool enriched the links ('perplexity', 'tavily', 'manual') */
  linksEnrichmentSource: varchar("linksEnrichmentSource", { length: 50 }),
  /**
   * JSON object tracking enrichment status per platform.
   * Shape: { youtube?: { channelId, subscriberCount, enrichedAt }, ted?: { talkUrl, viewCount, enrichedAt }, substack?: { url, enrichedAt }, ... }
   * Null means not yet checked; empty object means checked but no presence found.
   */
  platformEnrichmentStatus: text("platformEnrichmentStatus"),
  /**
   * JSON array of all named websites for this author (supersedes individual websiteUrl/businessWebsiteUrl/speakingUrl/blogUrl/podcastUrl/newsletterUrl).
   * Shape: [{label: string, url: string, type: 'personal'|'company'|'speaking'|'podcast'|'course'|'blog'|'newsletter'|'ted'|'masterclass'|'other'}]
   */
  websitesJson: text("websitesJson"),
  /**
   * JSON array of professional/career entries (resume-style).
   * Shape: [{title: string, org: string, period: string, description: string, url?: string}]
   */
  professionalEntriesJson: text("professionalEntriesJson"),
  /**
   * JSON object with enriched full bio (double-pass LLM).
   * Shape: {fullBio: string, professionalSummary: string, personalNote?: string, enrichedAt: string, model: string}
   */
  richBioJson: text("richBioJson"),
  /** Confidence level for research quality: high | medium | low */
  researchQuality: mysqlEnum("researchQuality", ["high", "medium", "low"]),
  enrichedAt: timestamp("enrichedAt"),
  /** Google Drive folder ID for this author's folder in 02 — Knowledge Library / 01 — Authors */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  /**
   * JSON array of tag slugs applied to this author, e.g. ["must-read", "leadership", "favorite"].
   * Tags are defined in the `tags` table; this column is a denormalized cache for fast filtering.
   */
  tagsJson: text("tagsJson"),
  /**
   * JSON object with structured media presence data across platforms.
   * Shape: {
   *   youtube?: { channelId, channelUrl, subscriberCount, videoCount, totalViews, fetchedAt },
   *   ted?: { profileUrl, talkCount, totalViews, latestTalkUrl, latestTalkTitle, fetchedAt },
   *   substack?: { url, subscriberEstimate, postCount, fetchedAt },
   *   podcast?: { showUrl, episodeCount, platform, fetchedAt },
   *   masterclass?: { courseUrl, courseTitle, fetchedAt },
   *   enrichedAt: string,
   * }
   */
  mediaPresenceJson: text("mediaPresenceJson"),
  /** When mediaPresenceJson was last enriched */
  mediaPresenceEnrichedAt: timestamp("mediaPresenceEnrichedAt"),
  /**
   * JSON object with business and professional profile data.
   * Shape: {
   *   company?: { name, role, url, description },
   *   speakingTopics?: string[],
   *   speakingFee?: { range, currency },
   *   awards?: [{ name, year, org }],
   *   education?: [{ degree, institution, year }],
   *   boardMemberships?: [{ org, role, url }],
   *   enrichedAt: string,
   * }
   */
  businessProfileJson: text("businessProfileJson"),
  /** When businessProfileJson was last enriched */
  businessProfileEnrichedAt: timestamp("businessProfileEnrichedAt"),
  /**
   * Academic research profile from OpenAlex / Semantic Scholar.
   * JSON string of AcademicEnrichmentResult: authorProfile (hIndex, citations, affiliations),
   * topPapers (most-cited works), bookRelatedPapers (research behind books).
   */
  academicResearchJson: text("academicResearchJson"),
  /** When academicResearchJson was last enriched */
  academicResearchEnrichedAt: timestamp("academicResearchEnrichedAt"),
  /**
   * Similarweb traffic data for the author's primary website.
   * JSON string of SimilarwebTrafficResult: monthlyVisits, globalRank, trafficSources, etc.
   */
  webTrafficJson: text("webTrafficJson"),
  /** When webTrafficJson was last enriched */
  webTrafficEnrichedAt: timestamp("webTrafficEnrichedAt"),
  /**
   * JSON string of EnterpriseImpactResult: filingMentions, earningsCallMentions,
   * advisoryRoles, impactScore, uniqueCompanies.
   * Source: SEC EDGAR + Quartr API.
   */
  earningsCallMentionsJson: text("earningsCallMentionsJson"),
  /** When earningsCallMentionsJson was last enriched */
  earningsCallMentionsEnrichedAt: timestamp("earningsCallMentionsEnrichedAt"),
  /**
   * JSON string of ProfessionalProfileResult: roles, boardSeats, education,
   * awards, companyAffiliations.
   * Source: Wikipedia/Wikidata + Apollo.io.
   */
  professionalProfileJson: text("professionalProfileJson"),
  /** When professionalProfileJson was last enriched */
  professionalProfileEnrichedAt: timestamp("professionalProfileEnrichedAt"),
  /**
   * JSON string of DocumentArchive: documents list with Drive file metadata.
   * Source: Google Drive.
   */
  documentArchiveJson: text("documentArchiveJson"),
  /** When documentArchiveJson was last indexed */
  documentArchiveEnrichedAt: timestamp("documentArchiveEnrichedAt"),

  // ── Contextual Intelligence (geography, history, family, associations) ──────
  /**
   * JSON object with full geographical biography.
   * Shape: {
   *   birthCity, birthCountry, childhoodCity, formativeCities: string[],
   *   currentBase, countriesLived: string[], culturalRegions: string[],
   *   geographyNarrative: string  // LLM synthesis of how geography shaped worldview
   * }
   */
  geographyJson: text("geographyJson"),
  /**
   * JSON object with historical/era context.
   * Shape: {
   *   birthDecade: string, formativeYears: { from: number, to: number },
   *   majorWorldEvents: [{ year: number, event: string, relevance: string }],
   *   culturalEra: string, eraNarrative: string
   * }
   */
  historicalContextJson: text("historicalContextJson"),
  /**
   * JSON object with family and upbringing data.
   * Shape: {
   *   parents: [{ name, profession, nationality, notes }],
   *   siblings: { count: number, birthOrder: string, notes: string },
   *   spouse: { name, profession, duration, notes },
   *   children: { count: number, notes: string },
   *   familyCulture: { religion, politicalLeanings, socioeconomicClass, immigrationBackground, notes }
   * }
   */
  familyJson: text("familyJson"),
  /**
   * JSON object with associations, networks, and intellectual lineage.
   * Shape: {
   *   mentors: [{ name, relationship, contribution }],
   *   proteges: [{ name, notes }],
   *   collaborators: [{ name, type: 'co-author'|'co-presenter'|'business', notes }],
   *   intellectualRivals: [{ name, disagreement }],
   *   organizations: [{ name, role, type: 'think-tank'|'board'|'conference'|'association', url }],
   *   universities: [{ name, degree, year, role: 'student'|'faculty'|'honorary' }],
   *   schoolsOfThought: string[],
   *   citedInfluences: [{ name, type: 'author'|'thinker'|'book', notes }],
   *   intellectualDescendants: [{ name, notes }],
   *   signatureFrameworks: [{ name, description, year }]
   * }
   */
  associationsJson: text("associationsJson"),
  /**
   * JSON object with formative experiences (pivotal moments).
   * Shape: [{ type: 'trauma'|'epiphany'|'career'|'travel'|'loss'|'other', description: string, approximateYear?: number, source: string }]
   */
  formativeExperiencesJson: text("formativeExperiencesJson"),
  /** Raw source responses from the 8-source biographical research waterfall — stored for auditability */
  authorBioSourcesJson: text("authorBioSourcesJson"),
  /** Completeness score 0–100 based on populated biographical fields */
  bioCompleteness: int("bioCompleteness").default(0),
  /** When the contextual intelligence layer was last enriched */
  contextualIntelligenceEnrichedAt: timestamp("contextualIntelligenceEnrichedAt"),

  // ── News Cache ──────────────────────────────────────────────────────────────
  /**
   * Cached news articles for this author from Google News RSS.
   * Shape: [{ title, url, source, publishedAt, snippet }]
   */
  newsCacheJson: text("newsCacheJson"),
  /** When newsCacheJson was last fetched */
  newsCachedAt: timestamp("newsCachedAt"),
  /**
   * Cached CNBC mentions for this author.
   * Shape: [{ title, url, source, publishedAt, snippet }]
   */
  cnbcMentionsCacheJson: text("cnbcMentionsCacheJson"),
  /** When cnbcMentionsCacheJson was last fetched */
  cnbcMentionsCachedAt: timestamp("cnbcMentionsCachedAt"),

  /**
   * JSON array of conversation group slugs this author belongs to.
   * Shape: ["superconversations", ...]
   * "superconversations" is the first group (author chatbot agents).
   */
  conversationGroups: text("conversationGroups"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in enrichment waterfall) */
  authorNameIdx: index("author_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched rows quickly */
  enrichedAtIdx: index("author_profiles_enrichedAt_idx").on(table.enrichedAt),
  /** Index for batch queries filtering by avatar source (e.g. upgrading Drive-sourced avatars) */
  avatarSourceIdx: index("author_profiles_avatarSource_idx").on(table.avatarSource),
  /** T1-B: Index for sorting/filtering by bio completeness score (chatbot readiness pipeline) */
  bioCompletenessIdx: index("author_profiles_bioCompleteness_idx").on(table.bioCompleteness),
}));

export type AuthorProfile = typeof authorProfiles.$inferSelect;
export type InsertAuthorProfile = typeof authorProfiles.$inferInsert;


// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL AUTHOR RAG PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * author_rag_profiles — tracks the Digital Me RAG file for each author.
 * The RAG file is a structured Markdown document stored in S3 that encapsulates
 * everything the system knows about an author in a form suitable for LLM system
 * prompt injection (author impersonation chatbot).
 */
export const authorRagProfiles = mysqlTable("author_rag_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull().unique(),
  /** S3 URL of the RAG Markdown file */
  ragFileUrl: varchar("ragFileUrl", { length: 1024 }),
  /** S3 key for the RAG file (used for versioning and cleanup) */
  ragFileKey: varchar("ragFileKey", { length: 512 }),
  /** Monotonically increasing version number (starts at 1) */
  ragVersion: int("ragVersion").notNull().default(1),
  /** When this version of the RAG file was generated */
  ragGeneratedAt: timestamp("ragGeneratedAt"),
  /** Word count of the RAG file */
  ragWordCount: int("ragWordCount"),
  /** LLM model used for the final synthesis call */
  ragModel: varchar("ragModel", { length: 128 }),
  /** LLM vendor used for the final synthesis call */
  ragVendor: varchar("ragVendor", { length: 64 }),
  /** Number of content items included in this RAG generation */
  contentItemCount: int("contentItemCount").notNull().default(0),
  /** Bio completeness score at the time of RAG generation (0–100) */
  bioCompletenessAtGeneration: int("bioCompletenessAtGeneration"),
  /** Pipeline status */
  ragStatus: mysqlEnum("ragStatus", ["pending", "generating", "ready", "stale"]).notNull().default("pending"),
  /** Error message if the last generation failed */
  ragError: text("ragError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  authorNameIdx: index("author_rag_profiles_authorName_idx").on(table.authorName),
  ragStatusIdx: index("author_rag_profiles_ragStatus_idx").on(table.ragStatus),
}));

export type AuthorRagProfile = typeof authorRagProfiles.$inferSelect;
export type InsertAuthorRagProfile = typeof authorRagProfiles.$inferInsert;

/**
 * author_subscriptions — periodic refresh subscriptions per author per platform.
 * Enables the system to monitor for new content (new YouTube videos, Substack posts, etc.)
 */
export const authorSubscriptions = mysqlTable("author_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull(),
  /** Platform being monitored */
  platform: mysqlEnum("platform", [
    "youtube", "substack", "podcast", "medium", "newsletter",
    "google_books", "amazon", "twitter", "linkedin"
  ]).notNull(),
  /** Platform-specific identifier (channel ID, feed URL, etc.) */
  platformId: varchar("platformId", { length: 512 }),
  /** Feed URL for polling */
  feedUrl: varchar("feedUrl", { length: 1024 }),
  /** Whether this subscription is active */
  enabled: int("enabled").notNull().default(1),
  /** Polling interval in hours */
  intervalHours: int("intervalHours").notNull().default(24),
  /** When this subscription was last polled */
  lastPolledAt: timestamp("lastPolledAt"),
  /** When new content was last found */
  lastNewContentAt: timestamp("lastNewContentAt"),
  /** Number of new items found in the last poll */
  lastPollNewCount: int("lastPollNewCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  authorPlatformIdx: index("author_subscriptions_author_platform_idx").on(table.authorName, table.platform),
}));

export type AuthorSubscription = typeof authorSubscriptions.$inferSelect;
export type InsertAuthorSubscription = typeof authorSubscriptions.$inferInsert;


// ── Author Aliases ─────────────────────────────────────────────────────────────
/**
 * Maps raw author name variants (e.g. from Dropbox folder names) to their
 * canonical display names. Replaces the hardcoded client/src/lib/authorAliases.ts.
 *
 * rawName  = the variant string (e.g. "Matthew Dixon - Sales strategy and customer psychology experts")
 * canonical = the clean display name (e.g. "Matthew Dixon")
 */
export const authorAliases = mysqlTable("author_aliases", {
  id: int("id").autoincrement().primaryKey(),
  /** The raw/variant name to normalize */
  rawName: varchar("rawName", { length: 512 }).notNull().unique(),
  /** The canonical display name to resolve to */
  canonical: varchar("canonical", { length: 256 }).notNull(),
  /** Optional note explaining why this alias exists */
  note: varchar("note", { length: 512 }),
  createdAt: timestamp("createdAt_aa").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt_aa").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  rawNameIdx: index("rawName_idx").on(t.rawName),
  canonicalIdx: index("canonical_idx").on(t.canonical),
}));
export type AuthorAlias = typeof authorAliases.$inferSelect;
export type InsertAuthorAlias = typeof authorAliases.$inferInsert;
