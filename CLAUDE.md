# CLAUDE.md — Ricardo Cidale's Library

This file provides context for AI coding assistants (Claude Code, Manus, Gemini CLI, etc.)
working on this codebase. Read this before making any changes.

---

## Project Overview

**Ricardo Cidale's Library** (`authors-books-library`) is a personal digital library
for Ricardo Cidale / Norfolk Consulting Group. It displays 109 authors and 178 books
sourced from a Google Drive folder hierarchy, enriched with AI-generated bios, author
avatars, book cover images, ratings, and summaries.

**Live URL:** `https://authlib-ehsrgokn.manus.space`
**GitHub:** `https://github.com/norfolk-ai/authors-books-library` (private)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Flowbite React 0.12.16, shadcn/ui, Radix UI |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | MySQL / TiDB (via `DATABASE_URL`) |
| File storage | Manus S3 CDN (`storagePut` / `storageGet` in `server/storage.ts`) |
| Auth | Manus OAuth (`/api/oauth/callback`, `protectedProcedure`) |
| Build | Vite 6.4.1, esbuild, TypeScript 5.9 |
| Testing | Vitest — 217 tests across 17 test files in `server/*.test.ts` |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Enrichment APIs | Google Books, Apify cheerio-scraper, Replicate flux-schnell, Perplexity Sonar, Wikipedia, YouTube Data API v3, Twitter/X API v2 |
| Animation | Framer Motion, React Three Fiber + Drei (sparkles canvas) |
| Logging | `server/lib/logger.ts` — structured logger with `debug` (suppressed in prod) / `info` / `warn` / `error` levels |

> **Flowbite version pin:** flowbite-react is pinned to `0.12.16`. Do NOT upgrade to
> `0.12.17+` — those versions introduce `oxc-parser` which has a native binding that
> fails in the deployment environment.

> **Vite version pin:** Pinned to `6.x`. Do NOT upgrade to Vite 7 — the deployment
> environment runs Node.js 20.15.1 which is below Vite 7's minimum of 20.19+.

---

## File Structure

```
client/src/
  pages/
    Home.tsx               ← Main library view (Authors / Books / Audiobooks tabs)
    Admin.tsx              ← Admin Console (11 tabs: authors, books, pipeline, media, cascade, settings, ai, tools, scheduling, favorites, about)
    AuthorDetail.tsx       ← /author/:slug deep-link page
    BookDetail.tsx         ← /book/:slug deep-link page
    AuthorCompare.tsx      ← /compare — side-by-side author comparison
    Leaderboard.tsx        ← /leaderboard — enrichment quality leaderboard
    NotFound.tsx           ← 404 page with breadcrumb
  components/
    FlowbiteAuthorCard.tsx  ← Primary author card (cover strip + hover tooltips + 3 hotspots + isMutating overlay)
    AuthorModal.tsx         ← Full author detail modal (bio, avatar, social links, avatar gen)
    AuthorCardActions.tsx   ← Card-level enrichment action buttons (with onMutatingChange callback)
    BookCardActions.tsx     ← Book card enrichment action buttons
    AuthorAccordionRow.tsx  ← Accordion view row (same 3-hotspot model as card)
    AvatarUpload.tsx        ← Click-to-upload author avatar with crop modal
    AvatarCropModal.tsx     ← react-image-crop circular crop + zoom
    FavoriteToggle.tsx      ← Heart toggle for favoriting authors/books
    ResearchQualityBadge.tsx ← HIGH/MEDIUM/LOW badge with coloured dot + tooltip
    BackToTop.tsx           ← Scroll-to-top button
    ErrorBoundary.tsx       ← React error boundary wrapper
    DashboardLayout.tsx     ← Sidebar layout wrapper
    PageHeader.tsx          ← Breadcrumb nav bar for non-home pages
    library/
      AuthorBioPanel.tsx    ← Slide-in author bio panel (links, social stats, authorDescriptionJson collapsible)
      AuthorCard.tsx        ← Compact author card variant
      BookCard.tsx          ← Book card with keyboard nav (Enter/Space to open)
      BookDetailPanel.tsx   ← Book detail slide-in panel
      AudioCard.tsx         ← Audiobook card
      PlatformPills.tsx     ← Platform presence pills (YouTube, TED, Substack, etc.)
      FreshnessDot.tsx      ← Enrichment freshness indicator dot
      LibraryPrimitives.tsx ← Shared library UI primitives
      libraryConstants.ts   ← ENRICH_LABELS, QUALITY_ORDER, ENRICH_ORDER (module-level constants)
    admin/
      ActionCard.tsx        ← Reusable admin action card with status + button
      AiTab.tsx             ← AI model selection + avatar generation settings
      CascadeTab.tsx        ← Enrichment waterfall stats
      InformationToolsTab.tsx ← API key status cards (Tavily, YouTube, Twitter, etc.)
      SchedulingTab.tsx     ← Pipeline schedules + recent job history + manual triggers
      FavoritesTab.tsx      ← Favorited authors/books with quick-remove
      SettingsTab.tsx       ← App settings (theme, Drive sync, etc.)
      AboutTab.tsx          ← Project info
      adminTypes.ts         ← Shared admin TypeScript types
server/routers/
  authorProfiles.router.ts  ← Bio, avatar, social link enrichment; getAllBios; generatePortrait; discoverPlatforms; enrichSocialStats; enrichRichBio
  bookProfiles.router.ts    ← Summary, cover, rating enrichment; enrichAllMissingSummaries; enrichRichSummary
  admin.router.ts           ← getActionLogs, getToolStatus, getYouTubeStatsSummary, recordAction
  apify.router.ts           ← Apify Amazon scrape + S3 mirror for covers and avatars
  cascade.router.ts         ← ResearchCascade waterfall stats (authorStats + bookStats)
  favorites.router.ts       ← toggle, list, checkMany, topFavorited
  library.router.ts         ← Drive sync, author/book list queries
  llm.router.ts             ← LLM model list + test ping (714 lines — model catalogue + router)
  scheduling.router.ts      ← listSchedules, listRecentJobs, toggleSchedule, triggerPipeline
  index.ts                  ← Merges all routers into appRouter
server/enrichment/
  socialStats.ts            ← Orchestrates YouTube + Twitter + Substack stats
  youtube.ts                ← YouTube Data API v3 channel stats
  twitter.ts                ← Twitter/X API v2 follower count (requires Basic plan for read access)
  substack.ts               ← Substack public API subscriber range + post count
  ted.ts                    ← TED talk scraper (Apify cheerio-scraper)
  platforms.ts              ← Platform URL discovery (Tavily + LLM)
  richBio.ts                ← Rich structured bio (LLM JSON schema)
  richSummary.ts            ← Rich structured book summary (LLM JSON schema)
  wikipedia.ts              ← Wikipedia bio + photo fetch
  github.ts                 ← GitHub profile stats
  cnn.ts                    ← CNN article search
  rapidapi.ts               ← RapidAPI enrichment helpers
  ycombinator.ts            ← Y Combinator company search
server/lib/
  logger.ts                 ← Structured logger (debug suppressed in prod, info/warn/error always emit)
  parallelBatch.ts          ← Generic parallel batch executor (concurrency=2, generic TInput)
  authorEnrichment.ts       ← Wikipedia → Perplexity → LLM bio pipeline
  bookEnrichment.ts         ← Google Books → LLM summary pipeline
  authorLinks.ts            ← Author URL discovery and update
  httpClient.ts             ← Shared HTTP client with retry logic
  staleness.ts              ← Enrichment freshness scoring
  authorAvatars/
    waterfall.ts            ← 5-tier avatar resolution waterfall (T1 Wikipedia → T5 AI)
    meticulousPipeline.ts   ← Full AI generation pipeline (research → vision → prompt → generate → S3)
    authorResearcher.ts     ← Stage 1-2: research + Gemini/Claude vision analysis
    promptBuilder.ts        ← Stage 3: AuthorDescription → vendor-specific ImagePromptPackage
    tavily.ts               ← Consolidated Tavily image search helper (scoring + multi-photo)
    imageGenerators/
      google.ts             ← Google Imagen / Nano Banana generator
      replicate.ts          ← Replicate flux-schnell/dev/pro generator
drizzle/
  schema.ts                 ← Four tables: users, author_profiles, book_profiles, sync_status
```

---

## Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `Home.tsx` | Main library (Authors / Books / Audiobooks tabs) |
| `/author/:slug` | `AuthorDetail.tsx` | Deep-link author detail page |
| `/book/:slug` | `BookDetail.tsx` | Deep-link book detail page |
| `/compare` | `AuthorCompare.tsx` | Side-by-side author comparison |
| `/leaderboard` | `Leaderboard.tsx` | Enrichment quality leaderboard |
| `/admin` | `Admin.tsx` | Admin Console (auth-gated) |
| `/404` | `NotFound.tsx` | 404 fallback |

---

## Database Schema

### `author_profiles` — keyed by `authorName` (canonical display name)

| Column | Type | Notes |
|---|---|---|
| `authorName` | varchar(256) PK | Canonical name, e.g. "Adam Grant" |
| `bio` | text | LLM/Wikipedia-generated bio |
| `avatarUrl` | varchar(1024) | External avatar URL (original source) |
| `avatarSourceUrl` | varchar(1024) | Best reference photo URL used for AI generation |
| `s3AvatarUrl` | varchar(1024) | CDN URL for mirrored avatar |
| `s3AvatarKey` | varchar(512) | S3 key for mirrored avatar |
| `avatarSource` | enum | `wikipedia \| tavily \| apify \| ai \| google-imagen \| drive` |
| `avatarGenVendor` | varchar(50) | e.g. `google`, `replicate` |
| `avatarGenModel` | varchar(100) | e.g. `nano-banana`, `flux-schnell` |
| `avatarResearchVendor` | varchar(50) | e.g. `google`, `anthropic` |
| `authorDescriptionJson` | text | Cached `AuthorDescription` JSON from Stage 2 vision analysis |
| `authorDescriptionCachedAt` | timestamp | When the description cache was last updated |
| `lastAvatarPrompt` | text | Last prompt sent to image generator |
| `bestReferencePhotoUrl` | varchar(1024) | Best real photo URL found at Tier 1-3 |
| `websiteUrl` | varchar(512) | Author's website |
| `twitterUrl` | varchar(512) | Twitter/X profile URL |
| `linkedinUrl` | varchar(512) | LinkedIn profile URL |
| `youtubeUrl` | varchar(512) | YouTube channel URL |
| `substackUrl` | varchar(512) | Substack URL |
| `podcastUrl` | varchar(512) | Podcast URL |
| `blogUrl` | varchar(512) | Blog URL |
| `githubUrl` | varchar(512) | GitHub URL |
| `instagramUrl` | varchar(512) | Instagram URL |
| `tiktokUrl` | varchar(512) | TikTok URL |
| `facebookUrl` | varchar(512) | Facebook URL |
| `speakingUrl` | varchar(512) | Speaking/events page URL |
| `businessWebsiteUrl` | varchar(512) | Business website URL |
| `newsletterUrl` | varchar(512) | Newsletter URL |
| `substackPostCount` | int | Number of Substack posts published |
| `substackSubscriberRange` | varchar(50) | e.g. `"10k-50k"` |
| `substackStatsEnrichedAt` | timestamp | Last Substack stats fetch |
| `socialStatsJson` | text | YouTube + Twitter + Substack stats JSON |
| `socialStatsEnrichedAt` | timestamp | Last social stats enrichment |
| `richBioJson` | text | Structured rich bio (fullBio, professionalSummary, personalNote) |
| `mediaPresenceJson` | text | Platform presence data (YouTube, TED, Substack, LinkedIn, etc.) |
| `mediaPresenceEnrichedAt` | timestamp | Last media presence enrichment |
| `businessProfileJson` | text | Business/speaking profile data |
| `businessProfileEnrichedAt` | timestamp | Last business profile enrichment |
| `platformEnrichmentStatus` | text | Per-platform enrichment status JSON |
| `newspaperArticlesJson` | text | Newspaper article links JSON |
| `otherLinksJson` | text | Miscellaneous links JSON |
| `websitesJson` | text | All discovered website URLs JSON |
| `professionalEntriesJson` | text | Professional directory entries JSON |
| `lastLinksEnrichedAt` | timestamp | Last links enrichment |
| `linksEnrichmentSource` | varchar(50) | Source of last links enrichment |
| `enrichedAt` | timestamp | Last bio enrichment |
| `driveFolderId` | varchar(128) | Google Drive folder ID |
| `createdAt` | timestamp | Row creation time |
| `updatedAt` | timestamp | Row last update time |

**Indexes:** `authorName` (unique), `enrichedAt`, `avatarSource`

### `book_profiles` — keyed by `bookTitle` (display title, unique)

| Column | Type | Notes |
|---|---|---|
| `bookTitle` | varchar(512) PK | Display title |
| `authorName` | varchar(256) | Author display name |
| `summary` | text | Google Books / LLM summary |
| `keyThemes` | text | Key themes JSON array |
| `rating` | decimal(3,1) | Google Books rating (0 = not available) |
| `ratingCount` | int | Number of ratings |
| `amazonUrl` | varchar(512) | Amazon product page URL |
| `goodreadsUrl` | varchar(512) | Goodreads URL |
| `coverImageUrl` | varchar(1024) | External cover URL (`not-found` or `skipped` if failed) |
| `s3CoverUrl` | varchar(1024) | Mirrored CDN URL |
| `s3CoverKey` | varchar(512) | S3 key |
| `publishedDate` | varchar(32) | Publication date string |
| `isbn` | varchar(20) | ISBN |
| `publisher` | varchar(256) | Publisher name |
| `enrichedAt` | timestamp | Last enrichment |

**Indexes:** `authorName`, `enrichedAt`

### `sync_status` — single row tracking last Drive sync

| Column | Notes |
|---|---|
| `lastSyncedAt` | UTC ms timestamp of last successful Drive scan |
| `authorCount` | Number of author folders found |
| `bookCount` | Number of book folders found |

---

## Key Conventions

### Author Name Normalization
Always use `canonicalName(rawName)` from `client/src/lib/authorAliases.ts` before
any DB lookup or map access. The same author may appear as "Adam Grant",
"Adam M. Grant", or "Grant, Adam" in raw Drive data.

### Book Deduplication (Two Layers — Never Add a Third)
Books are deduplicated by `titleKey` (lowercase slug) at exactly **two layers**:
1. `filteredAuthors` in `Home.tsx` — before passing to cards (Map<titleKey, BookRecord>)
2. `dedupedBooks` in `FlowbiteAuthorCard.tsx` — safety net inside the card (Set<string>)

The `titleKey` derivation strips the ` - Author` suffix from Drive folder names:
```ts
const titleKey = name.includes(" - ")
  ? name.slice(0, name.lastIndexOf(" - ")).trim().toLowerCase()
  : name.trim().toLowerCase();
```

Do not add a third dedup layer — it will cause books to disappear from cards.

### Tooltip Pattern (Radix `Tooltip`)
- **Author bio tooltip:** `bio` prop on `FlowbiteAuthorCard` — `authorBios.json` first,
  then `dbBioMap` from `getAllBios` tRPC query as fallback. Only shown when bio is available.
- **Book cover tooltip:** `bookInfoMap` prop — `Map<titleKey, { summary, rating, ratingCount }>`
  built from `bookCoversQuery` in `Home.tsx`. Shows title, summary snippet, and ★ rating badge.
  Rating badge only appears when `rating > 0`.

### FlowbiteAuthorCard — 3 Hotspot Model
The card has exactly three interactive zones:
1. **Avatar + author name group** → opens `AuthorModal`
2. **Book title / mini cover thumbnail** → opens `BookModal`
3. **Card surface (anywhere else)** → opens bio panel in parent via `onBioClick`

All other elements (category chip, Bio ready dot, resource pills) are non-interactive.
Do not add new click handlers outside these three zones.

### Card Loading Overlay
`FlowbiteAuthorCard` has an `isMutating` state that shows a frosted spinner overlay
over the card while any enrichment mutation is running. The `AuthorCardActions` component
calls `onMutatingChange(true/false)` to control this state. Do not bypass this — always
use `onMutatingChange` from `AuthorCardActions` props to signal loading state.

### S3 Storage
Use `storagePut(key, buffer, contentType)` from `server/storage.ts`. Key conventions:
- Author avatars (AI-generated): `author-avatars/ai-<8-char-hex>.jpg`
- Author avatars (real): `author-avatars/<8-char-hex>.jpg`
- Book covers: `book-covers/<8-char-hex>.<ext>`

Never store file bytes in the database. Store only the S3 key and CDN URL.

### Logging
Use `logger` from `server/lib/logger.ts` instead of raw `console.log` in all server code:
- `logger.debug(...)` — verbose per-item progress (suppressed in production)
- `logger.info(...)` — operational milestones (always emitted)
- `logger.warn(...)` — non-fatal issues (always emitted)
- `logger.error(...)` — errors (always emitted)

Never use `console.log` directly in server production code.

### Parallel Batch Processing
Use `parallelBatch<TInput>` from `server/lib/parallelBatch.ts` for all batch procedures.
The function is generic over input type (not just `string[]`). Default concurrency is 2.
All three batch procedures (`discoverPlatformsBatch`, `enrichSocialStatsBatch`, `enrichRichBioBatch`)
use `parallelBatch` — do not revert to sequential `for` loops.

### Module-Level Constants in Home.tsx
`ENRICH_LABELS`, `QUALITY_ORDER`, and `ENRICH_ORDER` are defined at module level
(outside the component) in `client/src/lib/libraryConstants.ts`. Do not move them
inside `useMemo` callbacks — they are stable references and don't need memoization.

### Enrichment Procedures

| Procedure | What it does |
|---|---|
| `authorProfiles.enrich` | Single author: Wikipedia → Perplexity → LLM fallback |
| `authorProfiles.enrichBatch` | Batch: same pipeline for multiple authors |
| `authorProfiles.generateAvatar` | Single author: full meticulous pipeline |
| `authorProfiles.generateAllMissingAvatars` | Batch: `parallelBatch` concurrency=2 |
| `authorProfiles.normalizeAvatarBackgrounds` | Force-regenerate all avatars with canonical bokeh-gold background |
| `authorProfiles.discoverPlatforms` | Single author: Tavily + LLM platform URL discovery |
| `authorProfiles.discoverPlatformsBatch` | Batch: `parallelBatch` concurrency=2 |
| `authorProfiles.enrichSocialStats` | Single author: YouTube + Twitter + Substack stats |
| `authorProfiles.enrichSocialStatsBatch` | Batch: `parallelBatch` concurrency=2 |
| `authorProfiles.enrichRichBio` | Single author: structured rich bio (LLM JSON schema) |
| `authorProfiles.enrichRichBioBatch` | Batch: `parallelBatch` concurrency=2 |
| `authorProfiles.updateAuthorLinks` | Single author: update all platform URLs |
| `authorProfiles.getAllBios` | Returns all rows with non-empty bio (for tooltip map) |
| `authorProfiles.getRecentlyEnriched` | Returns 6 most recently enriched authors (for home page strip) |
| `bookProfiles.enrich` | Single book: Google Books API → LLM fallback |
| `bookProfiles.enrichAllMissingSummaries` | Batch all books with no summary |
| `bookProfiles.enrichRichSummary` | Single book: structured rich summary (LLM JSON schema) |
| `bookProfiles.enrichRichSummaryBatch` | Batch: `parallelBatch` concurrency=2 |
| `bookProfiles.rebuildAllBookCovers` | Re-scrape + mirror all book covers |
| `scheduling.listSchedules` | List all pipeline schedules from `enrichment_schedules` table |
| `scheduling.listRecentJobs` | List recent enrichment job history |
| `scheduling.toggleSchedule` | Enable/disable a pipeline schedule |
| `scheduling.triggerPipeline` | Manually trigger a pipeline by name |
| `favorites.toggle` | Toggle favorite status for an author or book |
| `favorites.list` | List all favorites for the current user |
| `favorites.topFavorited` | Top favorited items across all users |
| `admin.getToolStatus` | Returns API key status for all configured tools |
| `admin.getYouTubeStatsSummary` | Returns aggregate YouTube stats + top channels leaderboard |

### Multi-Author Splitting
Authors with combined names (e.g. "Aaron Ross and Jason Lemkin") are split into
individual cards in `filteredAuthors`. The `dbPhotoMap` in `Home.tsx` is extended to
add individual name keys from combined entries so each split author gets their avatar.

---

## Design System

**Philosophy:** Editorial Intelligence — a private library aesthetic with Swiss Modernist
typography and warm paper tones.

| Token | Value |
|---|---|
| Heading font | IBM Plex Sans Bold / SemiBold |
| Body font | Inter / DM Sans |
| Mono font | JetBrains Mono |
| Background | Warm off-white `oklch(0.98 0.005 80)` |
| Foreground | Deep charcoal `oklch(0.235 0.015 65)` |
| Border radius | `0.65rem` |
| Card left border | 3px solid, category accent color |

**Multi-theme support:** Three themes — Manus (default), Norfolk AI, Noir Dark — are
defined as CSS variable sets in `client/src/index.css`. The active theme is stored in
`localStorage` via `AppSettingsContext` and applied via `ThemeProvider` in `App.tsx`.

**Category color system** (defined in `libraryData.ts`):

| Category | Accent |
|---|---|
| Business & Entrepreneurship | `#b45309` (amber) |
| Behavioral Science & Psychology | `#7c3aed` (violet) |
| Sales & Negotiation | `#0369a1` (sky blue) |
| Leadership & Management | `#065f46` (emerald) |
| Self-Help & Productivity | `#b91c1c` (rose) |
| Communication & Storytelling | `#c2410c` (orange) |
| Technology & Futurism | `#1d4ed8` (blue) |
| Strategy & Economics | `#374151` (slate) |
| History & Biography | `#92400e` (brown) |

---

## Google Drive Structure

```
Norfolk Consulting Group/
├── Authors/
│   └── [Category]/
│       └── [Author Name - Specialty]/
│           └── [Book Title]/
│               ├── PDF/  Binder/  Transcript/  Audio/
├── Books/
│   └── [Category]/
│       └── [Book Title - Author]/
│           ├── PDF/  Binder/  Transcript/
└── Books Audio/
    └── [Book Title]/
        ├── MP3/  M4B/  AAX/
```

**Key Google Drive Folder IDs:**

| Folder | ID |
|---|---|
| Authors (root) | `119tuydLrpyvavFEouf3SCq38LAD4_ln5` |
| Author Avatars | `1XGBfvnqN3W9LFpFJjqhDEZVBRPrXGf9W` |
| Bios | `1DDxUQhlMmqudPFzkp5oOjru1zZd_XAl-` |

---

## Environment Variables

All secrets are injected by the Manus platform — never hardcode or commit them.
Always use `ENV` from `server/_core/env.ts` instead of `process.env` directly.

| Variable | `ENV` key | Used by |
|---|---|---|
| `DATABASE_URL` | `ENV.databaseUrl` | Drizzle ORM (MySQL/TiDB) |
| `JWT_SECRET` | `ENV.cookieSecret` | Session cookie signing |
| `APIFY_API_TOKEN` | `ENV.apifyApiToken` | Apify Amazon scraper + TED scraper |
| `BUILT_IN_FORGE_API_URL` | `ENV.forgeApiUrl` | Manus S3 / LLM / notification APIs |
| `BUILT_IN_FORGE_API_KEY` | `ENV.forgeApiKey` | Server-side Forge bearer token |
| `VITE_FRONTEND_FORGE_API_KEY` | (client-side) | Client-side Forge bearer token |
| `PERPLEXITY_API_KEY` | `ENV.perplexityApiKey` | Perplexity Sonar bio enrichment |
| `REPLICATE_API_TOKEN` | `ENV.replicateApiToken` | Replicate flux-schnell avatars |
| `TAVILY_API_KEY` | `ENV.tavilyApiKey` | Tavily image search |
| `GEMINI_API_KEY` | `ENV.geminiApiKey` | Google Imagen / Gemini vision |
| `ANTHROPIC_API_KEY` | `ENV.anthropicApiKey` | Claude vision analysis (Stage 2 fallback) |
| `YOUTUBE_API_KEY` | `ENV.youtubeApiKey` | YouTube Data API v3 channel stats |
| `TWITTER_BEARER_TOKEN` | `ENV.twitterBearerToken` | Twitter/X API v2 (requires Basic plan) |
| `RAPIDAPI_KEY` | `ENV.rapidApiKey` | RapidAPI enrichment helpers |
| `GOOGLE_BOOKS_API_KEY` | `ENV.googleBooksApiKey` | Google Books API |

---

## Development Commands

```bash
pnpm install
pnpm db:push        # generate + migrate schema (drizzle-kit generate && migrate)
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (217 tests, 17 files)
pnpm build          # production build
npx tsc --noEmit    # type check — ALWAYS trust this over the watcher
```

---

## Scheduled Jobs

A nightly cron runs `scripts/batch-scrape-covers.mjs` at **2am CDT (07:00 UTC)**
via the Manus scheduler. It scrapes Amazon for any books missing `coverImageUrl`,
then mirrors all pending covers to S3. The script is idempotent and safe to re-run.

---

## Test Files

| File | What it tests |
|---|---|
| `library.test.ts` | Drive sync, author/book list queries |
| `author-aliases.test.ts` | `canonicalName()` normalization |
| `batch-enrich.test.ts` | Batch enrichment pipeline |
| `sort-and-profiles.test.ts` | Sorting, filtering, profile queries |
| `apify.test.ts` | Amazon scrape + S3 mirror logic |
| `generate-portrait.test.ts` | Replicate portrait generation |
| `batch-portraits.test.ts` | Batch portrait pipeline |
| `auth.logout.test.ts` | Auth logout flow |
| `admin.router.test.ts` | Admin router procedures |
| `anthropic-key.test.ts` | Anthropic API key validation |
| `youtube-key.test.ts` | YouTube API key validation |
| `twitter.test.ts` | Twitter/X API helper (handles CreditsDepleted gracefully) |
| `socialStats.test.ts` | Social stats enrichment orchestrator |
| `favorites.test.ts` | Favorites toggle, list, checkMany |
| `lib/parallelBatch.test.ts` | Generic parallel batch executor |
| `lib/authorAvatars/promptBuilder.test.ts` | Avatar prompt builder |
| `lib/authorAvatars/googleImagenGeneration.test.ts` | Google Imagen generator |

---

## Reusable Skills (in `/home/ubuntu/skills/`)

These skills were created from patterns discovered in this project:

| Skill | Description |
|---|---|
| `book-cover-scrape-mirror` | Batch Amazon scrape + S3 mirror for book covers |
| `data-dedup-normalizer` | Detect and remove duplicate entries (DB + UI) |
| `library-content-enrichment` | Full enrichment workflow (avatars, bios, covers) |
| `webdev-card-system` | Flowbite card + modal system with 3-hotspot model |
| `webdev-flowbite` | Flowbite React + Tailwind v4 integration |
| `webdev-theme-aware-cards` | Theme-aware card backgrounds (bg-card pattern) |
| `webdev-visualizations` | ECharts + React Flow + Nivo charts |
| `webdev-apify-scraping` | Apify cheerio-scraper patterns for book/author data |
| `webdev-norfolk-ai-branding` | Norfolk AI brand tokens and design system |
| `webdev-page-header` | PageHeader breadcrumb nav component |
| `drive-media-folders` | Google Drive folder structure and sync patterns |
| `llm-recommendation-engine` | LLM-based recommendation engine patterns |
| `avatar-background-consistency` | Enforce uniform bokeh-gold background across all AI-generated avatars |
| `avatar-photo-recency` | Prefer most recent author photo in Tiers 1-3 of avatar waterfall |
| `author-avatar-terminology` | Canonical terminology for avatar pipeline stages and types |
| `skill-creation-workflow` | How to package a repeatable process into a skill |

---

## Avatar Generation Pipeline

### Architecture — 5-Stage Meticulous Pipeline

The pipeline lives in `server/lib/authorAvatars/` and runs sequentially:

| Stage | File | What it does |
|---|---|---|
| 1 — Research | `authorResearcher.ts` | Wikipedia + Tavily + Apify in parallel → `AuthorResearchData` |
| 2 — Vision Analysis | `authorResearcher.ts` | Gemini Vision (multimodal) or Claude → `AuthorDescription` JSON (cached in DB) |
| 3 — Prompt Build | `promptBuilder.ts` | Converts `AuthorDescription` → vendor-specific `ImagePromptPackage` |
| 4 — Image Gen | `imageGenerators/google.ts` or `replicate.ts` | Generates image bytes/URL |
| 5 — Storage | `meticulousPipeline.ts` | Uploads to S3, updates DB `s3AvatarUrl` |

If a real photo is found at Stage 1 and passes Gemini validation, the pipeline stops there. Only authors with no real photo reach Stage 4 (AI generation).

### Research LLM (Stage 2)

- **Default vendor:** Google (`gemini-2.5-flash`) — multimodal, inlines up to 4 reference photos as base64 image parts
- **Alternative vendor:** Anthropic (`claude-sonnet-4-5-20250929`) — text-only (no image inlining), falls back to Gemini if `ANTHROPIC_API_KEY` is missing
- The `AuthorDescription` JSON is cached in `author_profiles.authorDescriptionJson` — subsequent regenerations skip Stage 1–2 unless `forceRefresh: true`

### Image Generation (Stage 4) — Vendor Capabilities

| Vendor | Model | Controllable Params |
|---|---|---|
| Google | `nano-banana` (gemini image) | None — model-determined output (typically 1024×1024 PNG) |
| Google | `imagen-3` | `aspectRatio` only: `1:1`, `3:4`, `4:3`, `9:16`, `16:9` |
| Replicate | `flux-schnell` | `aspect_ratio`, `output_format`, `output_quality`, `num_inference_steps` (default 4) |
| Replicate | `flux-dev` / `flux-pro` | All of the above + `guidance_scale`, `width`, `height` (custom) |

**Default model:** `nano-banana` (Google Gemini image model) — fast, no cost per token, good quality for professional headshots.

### Key Rules

- **Never pass `aspectRatio` to Gemini image models** — only `generateImages` (Imagen 3) supports it; `generateContent` (Gemini image) does not.
- **`authorAvatars.ts` takes priority** over DB — if an author has an entry in this static map, the DB `s3AvatarUrl` is never queried for that author's card display.
- **`authorDescriptionJson` caching** — always check `useCache` flag before re-running Stage 1–2. The cache is per-author in `author_profiles.authorDescriptionJson`.

### Background Consistency

The canonical background for all AI-generated avatars is **`bokeh-gold`** — warm golden bokeh with soft amber/cream circular light orbs, shallow depth of field. This is the default value of `settings.avatarBgColor` in `AppSettingsContext`.

**Rule:** Always pass `settings.avatarBgColor` explicitly when calling `buildMeticulousPrompt()` or `buildGenericFallbackPrompt()`. An omitted `bgColor` falls back to `"neutral gray gradient"` which breaks visual consistency across the card grid.

The full background spec (all named presets, key files, audit procedure, and common pitfalls) is documented in the `avatar-background-consistency` skill at `/home/ubuntu/skills/avatar-background-consistency/SKILL.md`.

### Photo Recency (Tiers 1–3)

Always prefer the **most recent available photo** of an author. A 2010 photo produces an AI avatar that looks 15 years younger than the real person.

**Tier 1 (Wikipedia):** The REST API returns the current infobox photo — already the most recent. Upgrade resolution to `/600px-` (not 400px).

**Tier 2 (Tavily):** Two required changes:
- Query must include current year: `"${authorName}" author headshot photo ${year} OR ${year-1} OR ${year-2}`
- API params: `days: 730`, `max_results: 10`
- Scoring: boost URLs containing `2024/2025/2026` (+5), `speaker/keynote` (+6); penalise URLs containing `2010-2012` (-6)

**Tier 3 (Apify):** Amazon Author Central always shows the current photo — no recency filter needed.

**T5 Timeout:** Must be **≥ 240 seconds (4 minutes)**. Do not reduce — the pipeline silently times out and falls back to legacy generation which ignores background color.

Full rules documented in `avatar-photo-recency` skill at `/home/ubuntu/skills/avatar-photo-recency/SKILL.md`.

---

## Admin Console

The Admin Console (`/admin`) has 11 tabs:

| Tab | Component | Purpose |
|---|---|---|
| Authors | inline | Avatar stats, batch enrichment, background normalization |
| Books | inline | Cover stats, batch summary enrichment |
| Pipeline | inline | Enrichment pipeline controls and progress |
| Media | inline | S3 mirror stats and controls |
| Cascade | `CascadeTab.tsx` | Waterfall enrichment stats (authorStats + bookStats) |
| Settings | `SettingsTab.tsx` | App settings, Drive sync, theme |
| AI | `AiTab.tsx` | LLM model selection, avatar generation settings |
| Tools | `InformationToolsTab.tsx` | API key status cards (Tavily, YouTube, Twitter, etc.) |
| Scheduling | `SchedulingTab.tsx` | Pipeline schedules + recent job history + manual triggers |
| Favorites | `FavoritesTab.tsx` | Favorited authors/books with quick-remove |
| About | `AboutTab.tsx` | Project info |

---

## Common Pitfalls

**Stale TS watcher errors** — The incremental TypeScript watcher (`tsx watch`) can
show cached errors from before a fix. Always trust `npx tsc --noEmit` over the
watcher output. Clear the cache with `rm -f node_modules/.cache/typescript*` and
restart the server if needed.

**`bookInfoMap` vs `bookSummaryMap`** — The prop was renamed from `bookSummaryMap`
to `bookInfoMap` when rating data was added. If you see a TS error about
`bookSummaryMap`, it has been removed — use `bookInfoMap`.

**Protected vs public procedures** — Enrichment mutations use `adminProcedure`
(requires auth + admin role). Only user-specific operations use `protectedProcedure`.
Public read queries use `publicProcedure`.

**No local image assets** — All images must be uploaded to CDN via
`manus-upload-file --webdev` and referenced by URL. Never put images in
`client/public/` or `client/src/assets/`.

**flowbite-react version** — Do NOT upgrade past `0.12.16`. The `0.12.17+` versions
introduce `oxc-parser` which fails in the Manus deployment environment.

**Vite version** — Pinned to `6.x`. Do NOT upgrade to Vite 7 — the deployment
environment runs Node.js 20.15.1 which is below Vite 7's minimum of 20.19+.

**Pending DB duplicates** — 10 books share the same S3 cover URL (different title
variants for the same book) and 1 exact duplicate ("The Jolt Effect", ids 98 and
30005) are flagged for manual review. Run `node scripts/detect-duplicates.mjs` to
see the current state before any bulk operations.

**Twitter API credits** — The Twitter/X Free tier does not include read access to
user lookup endpoints. The `twitter.ts` helper handles `CreditsDepleted` gracefully
(returns `null`). A Basic plan ($100/mo) is required for live follower counts.

**`parallelBatch` generic type** — The function signature is `parallelBatch<TInput>`.
When passing object arrays, TypeScript infers the type automatically. Do not cast
to `string[]`.

---

## Scan Scripts (in `/home/ubuntu/`)

These Python scripts regenerate `libraryData.ts` and `audioData.ts` from Google Drive.

| Script | Purpose |
|---|---|
| `rescan_library.py` | Full deep scan → `library_scan_results.json` |
| `final_audio_move_v2.py` | Move audio files into Books Audio |
| `organize_authors.py` | Initial categorization of author folders |
| `organize_books.py` | Initial categorization of book folders |
