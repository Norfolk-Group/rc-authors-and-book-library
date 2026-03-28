# Ricardo Cidale's Authors & Books Library

## Standing Rules

**Last Updated:** March 28, 2026 — Codebase Audit & Optimization (dead code removal, file splits, libraryConstants extraction, llmCatalogue extraction, documentation overhaul)

> **MANDATORY:** At the end of every completed task, update this file (`claude.md`) to reflect any new features, architectural changes, component additions, data schema changes, or workflow changes made during that session. Also append a dated entry to `memory.md` summarising what was done. These two files are the source of truth for the project state. `manus.md` is a copy of `claude.md` — keep them in sync.

---

## Project Identity

**Name:** authors-books-library
**Path:** `/home/ubuntu/authors-books-library`
**Stack:** React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB
**Deployed:** `authlib-ehsrgokn.manus.space`
**Owner:** Ricardo Cidale / Norfolk AI (NCG)

This is a personal knowledge library application that catalogues business books and authors from a curated Google Drive folder structure. The app scans Drive folders, enriches content with metadata from external APIs, and presents it through a Swiss Modernist UI with three switchable themes.

---

## Architecture Overview

```
client/                                → React 19 SPA (Vite)
  src/
    pages/
      Home.tsx                         → Main library UI orchestrator (~814 lines)
      Admin.tsx                        → Admin Console orchestrator (~1493 lines)
      AuthorDetail.tsx                 → Author detail page (~728 lines)
      BookDetail.tsx                   → Book detail page (~563 lines)
      AuthorCompare.tsx                → Author comparison page (~383 lines)
      Leaderboard.tsx                  → Author leaderboard page (~319 lines)
      NotFound.tsx                     → 404 page
    components/
      library/                         → Library card/panel components
        LibrarySidebar.tsx             → Extracted sidebar (category filters, search, sort, view toggle) (~294 lines)
        BookCard.tsx                   → Single book card with cover thumbnail (~492 lines)
        AudioCard.tsx                  → Single audio book card (~102 lines)
        AuthorCard.tsx                 → Author card for library view (~285 lines)
        AuthorBioPanel.tsx             → Author bio slide-over panel (~659 lines)
        BookDetailPanel.tsx            → Book detail slide-over panel (~575 lines)
      admin/                           → Admin tab components
        AiTab.tsx                      → AI model selection tab (~203 lines, slim orchestrator)
        ModelSelector.tsx              → Vendor/model selector with Auto-Recommend button (~606 lines)
        BackgroundSelector.tsx         → Avatar background color picker (~159 lines)
        BatchRegenSection.tsx          → Batch regeneration controls (~146 lines)
        AvatarDetailTable.tsx          → Avatar audit detail table (~140 lines)
        AvatarResolutionControls.tsx   → Avatar resolution settings (~150 lines)
        DependenciesTab.tsx            → Native vs third-party dependency registry (~1004 lines)
        ToolHealthCheckTab.tsx         → Service health check runner (~481 lines)
        InformationToolsTab.tsx        → Information tools reference (~523 lines)
        CascadeTab.tsx                 → Research cascade stats display (~188 lines)
        AboutTab.tsx                   → App info and version (~73 lines)
        ActionCard.tsx                 → Reusable action card with progress (~148 lines)
        adminTypes.ts                  → Shared admin types (~45 lines)
      FlowbiteAuthorCard.tsx           → Author card (grid view, 3D tilt, avatar, book list) (~622 lines)
      AuthorAccordionRow.tsx           → Accordion list row for author (~379 lines)
      AuthorModal.tsx                  → Author detail modal (~305 lines)
      AuthorCardActions.tsx            → Author card action buttons (~303 lines)
      BackToTop.tsx                    → Floating back-to-top button (~69 lines)
      CoverLightbox.tsx                → Full-screen book cover viewer (~114 lines)
      AvatarCropModal.tsx              → Avatar upload + crop editor (~215 lines)
      AvatarUpload.tsx                 → Camera overlay → file picker → crop → S3 (~231 lines)
      FloatingBooks.tsx                → 3D floating book shapes (Three.js/Fiber decorative bg) (~116 lines)
    contexts/
      AppSettingsContext.tsx           → App settings (theme, icon set, LLM model, view mode)
                                         Replaces former ThemeContext.tsx (removed). Use useAppSettings() or useThemeCompat().
      IconContext.tsx                  → Icon set context (used by iconSets/)
    hooks/
      useLibraryData.ts                → Extracted data hooks + filtering logic (~457 lines)
      useConfetti.ts                   → No-op confetti stub (dependency removed)
    lib/
      libraryData.ts                   → Auto-generated Drive scan data (112 authors, 183 books, 9 categories) (~1981 lines)
                                         Re-exports all constants from libraryConstants.ts for backward compatibility.
      libraryConstants.ts              → Static constants extracted from libraryData.ts (~131 lines)
                                         (CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS, CONTENT_TYPE_ICONS,
                                          CONTENT_TYPE_COLORS, LIBRARY_STATS, CATEGORIES, BookEntry/AuthorEntry/BookRecord types)
      audioData.ts                     → Auto-generated audiobooks data (45 titles)
      authorAvatars.ts                 → Static author name → S3 CDN URL map
      authorAliases.ts                 → Drive folder name → display name normalization map
      iconSets/
        phosphorRegular.ts             → Phosphor regular icon set catalogue
        phosphorDuotone.tsx            → Phosphor duotone icon set catalogue
      trpc.ts                          → tRPC client binding
server/
  routers/                             → tRPC routers (feature-split)
    authorProfiles.router.ts           → Core CRUD + merges 3 sub-routers (~498 lines)
    authorAvatar.router.ts             → Avatar generation, upload, audit, normalize, stats (~484 lines)
    authorEnrichment.router.ts         → Rich bio, academic, enterprise, professional, document enrichment (~570 lines)
    authorSocial.router.ts             → Social stats, platform discovery, Twitter, business profile (~662 lines)
    bookProfiles.router.ts             → Book CRUD + enrichment procedures (~975 lines)
    library.router.ts                  → Google Drive scanning + TS code generation
    apify.router.ts                    → Amazon scraping + S3 mirroring
    cascade.router.ts                  → Research cascade stats
    admin.router.ts                    → Action log tracking
    llm.router.ts                      → Multi-vendor LLM router (~133 lines); data in server/lib/llmCatalogue.ts
    healthCheck.router.ts              → Service health check procedures
  lib/
    llmCatalogue.ts                    → Multi-vendor LLM catalogue: 13 vendors, 47 models, recommendation engine (~899 lines)
    authorAvatars/                     → 5-tier author avatar waterfall
      waterfall.ts                     → Main orchestrator (~402 lines)
      authorResearcher.ts              → Parallel research across 3 sources
      persistResult.ts                 → DB write helper (extracted from router)
      promptBuilder.ts                 → Avatar prompt construction
      types.ts                         → Avatar pipeline types
      googleImagenGeneration.ts        → Google Imagen generation
      replicateGeneration.ts           → Replicate Flux generation
      geminiValidation.ts              → Gemini vision photo validation
      tavily.ts                        → Tavily image search
      wikipedia.ts                     → Wikipedia photo fetch
    httpClient.ts                      → Shared fetch with timeout/retry (fetchJson, fetchBuffer)
    parallelBatch.ts                   → Parallel batch processing utilities
  enrichment/                          → 22 enrichment modules
    academicResearch.ts                → OpenAlex academic paper search
    apollo.ts                          → Wikipedia professional data
    cnn.ts                             → CNN stats
    context7.ts                        → Technical references (GitHub, docs)
    facebook.ts                        → Facebook page ID extraction
    gdrive.ts                          → Google Drive folder listing
    github.ts                          → GitHub username extraction + stats
    instagram.ts                       → Instagram username extraction
    notion.ts                          → Notion database sync
    platforms.ts                       → Multi-platform discovery (discoverAuthorPlatforms)
    quartr.ts                          → SEC EDGAR filings search
    rapidapi.ts                        → Yahoo Finance stats
    richBio.ts                         → LLM-powered rich biography generation
    richSummary.ts                     → LLM-powered rich book summary generation
    socialStats.ts                     → Social media stats aggregation
    substack.ts                        → Substack subdomain extraction
    ted.ts                             → TED Talk scraping
    tiktok.ts                          → TikTok username extraction
    twitter.ts                         → Twitter username extraction
    wikipedia.ts                       → Wikipedia stats + Wikidata social links
    ycombinator.ts                     → YC company stats
    youtube.ts                         → YouTube channel enrichment
  db.ts                                → Drizzle DB connection + base query helpers
  storage.ts                           → S3 upload/download via Manus Forge API
drizzle/
  schema.ts                            → All 9 table definitions (~512 lines)
  relations.ts                         → Drizzle relations
shared/
  const.ts                             → Google Drive folder IDs, auth constants
  types.ts                             → Shared TypeScript types
scripts/                               → One-off enrichment and maintenance scripts (17 files)
  README.md                            → Script usage guide
  backfill-*.ts                        → Wikipedia backfill scripts
  batch-*.mjs                          → Batch processing scripts
  enrich-*.ts                          → Enrichment pipeline scripts
  run-*.mjs / run-*.ts                 → Pipeline runners
  detect-duplicates.mjs / remove-duplicates.mjs → Duplicate management
  fix-alan-dib-covers.mjs              → One-off cover fix
  retry-*.ts                           → Retry failed enrichments
```

---

## Database Schema (9 Tables)

| Table | Purpose | Key Columns |
|---|---|---|
| `author_profiles` | Core author records | `id`, `driveId`, `name`, `category`, `displayName`, `bio`, `richBio`, `avatarUrl`, `coverImageUrl`, `rating`, `possession`, `format` |
| `book_profiles` | Core book records | `id`, `driveId`, `authorId`, `name`, `category`, `coverImageUrl`, `s3CoverUrl`, `amazonUrl`, `richSummary`, `rating`, `possession`, `format` |
| `author_social_stats` | Social media stats | `authorId`, `wikipedia`, `twitter`, `youtube`, `github`, `instagram`, `linkedin`, `substack`, `ted`, `tiktok`, `facebook`, `ycombinator`, `quartr`, `cnn` |
| `author_enrichment` | Enrichment metadata | `authorId`, `enrichedAt`, `source`, `status`, `richBioGeneratedAt`, `academicPapersCount` |
| `author_platforms` | Platform discovery | `authorId`, `platform`, `url`, `discoveredAt` |
| `author_documents` | Document links | `authorId`, `type`, `title`, `url`, `source` |
| `avatar_audit_log` | Avatar generation history | `authorId`, `tier`, `source`, `prompt`, `imageUrl`, `status`, `generatedAt` |
| `action_log` | Admin action history | `id`, `action`, `authorId`, `details`, `createdAt` |
| `users` | Auth users | `id`, `openId`, `name`, `email`, `role`, `createdAt` |

**Key fields added in recent sessions:**
- `author_profiles.possession` — `owned` | `wishlist` | `reading` | `read`
- `author_profiles.format` — `digital` | `physical` | `audio` | `both`
- `book_profiles.possession` — same enum as author
- `book_profiles.format` — same enum as author

---

## Google Drive Folder Structure

The app reads from two root folders in Google Drive. These are the **single source of truth** for the library's content catalogue. All data originates here; the database stores only enrichment metadata (bios, covers, ratings).

### Authors Root Folder

**Drive ID:** `119tuydLrpyvavFEouf3SCq38LAD4_ln5` (stored in `shared/const.ts` as `DRIVE_AUTHORS_ROOT` and `server/_core/env.ts` as `driveAuthorsFolderId`)

```
Authors Root/
├── Business & Entrepreneurship/
│   ├── Adam Grant/
│   │   ├── Hidden Potential/
│   │   │   ├── PDF/
│   │   │   ├── Transcript/
│   │   │   └── Audio MP3/          ← excluded from book content types
│   │   ├── Think Again/
│   │   └── Originals/
│   └── ...
├── Behavioral Science & Psychology/
├── Sales & Negotiation/
├── Leadership & Management/
├── Self-Help & Productivity/
├── Communication & Storytelling/
├── Technology & Futurism/
├── Strategy & Economics/
└── History & Biography/
```

**Hierarchy:** `Category → Author → Book → Content-Type → Files`

The scanner (`library.router.ts`) handles two folder layouts:
1. **Standard layout:** Author folder contains book subfolders, each containing content-type subfolders (PDF, Transcript, Video, etc.).
2. **Collapsed layout:** Author folder contains content-type subfolders directly (no book subfolder). The scanner treats the author folder itself as a single book entry.

**Content-type normalization** maps raw folder names to canonical types:

| Raw Folder Name | Normalized Type |
|---|---|
| `Book PDF`, `PDF Extra`, `Bonus PDF` | PDF |
| `Transcript Doc`, `Transcript PDF`, `Book Doc` | Transcript |
| `DOC` | DOC |
| `Images`, `Image` | Images |
| `Video` | Video |
| `Summary` | Summary |
| `Papers`, `Research Papers` | Papers |
| `Articles`, `Article` | Articles |

Audio folders (`Audio MP3`, `Audible`, `M4B`, etc.) are **excluded** from content-type counts.

### Books Audio Root Folder

**Drive ID:** `1-8bnr7xSAYucSFLW75E6DcP712eQ7wMU` (stored in `server/_core/env.ts` as `driveBooksAudioFolderId`)

Located under: `Norfolk Consulting Group / Books Audio`

```
Books Audio/
├── Author Name — Book Title.mp3
└── ...
```

Audio files are flat (no subfolders). The scanner matches them to author profiles by name.

---

## LLM Catalogue (server/lib/llmCatalogue.ts)

The multi-vendor LLM catalogue data lives in `server/lib/llmCatalogue.ts` (~899 lines). The `llm.router.ts` router (~133 lines) imports from it. **Do not add vendor/model data directly to the router.**

**13 vendors, 47 models** as of March 2026:

| Vendor | Key Models |
|---|---|
| OpenAI | gpt-4o, gpt-4o-mini, o1, o3-mini, o4-mini |
| Anthropic | claude-opus-4, claude-sonnet-4, claude-3-7-sonnet, claude-3-5-haiku |
| Google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro |
| Meta | llama-3.3-70b, llama-3.1-405b |
| Mistral | mistral-large-2, mistral-small-3 |
| Cohere | command-r-plus, command-r |
| xAI | grok-3, grok-3-mini |
| DeepSeek | deepseek-r1, deepseek-v3 |
| Perplexity | sonar-pro, sonar |
| Amazon | nova-pro, nova-lite |
| Microsoft | phi-4, phi-3.5-mini |
| IBM | granite-3.3-8b |
| Manus | manus-default |

The recommendation engine (`getRecommendedModels`) maps task types (bio generation, cover scraping, social enrichment, etc.) to optimal vendor/model combinations.

---

## Avatar Waterfall (5 Tiers)

The avatar resolution pipeline in `server/lib/authorAvatars/waterfall.ts` tries sources in order:

| Tier | Source | Description |
|---|---|---|
| 1 | S3 CDN | Previously uploaded custom or generated avatar |
| 2 | Tavily | Web image search for author photo |
| 3 | Wikipedia | Wikipedia infobox photo |
| 4 | Google Imagen | AI-generated portrait (Google Imagen 3) |
| 5 | Replicate Flux | AI-generated portrait (Replicate Flux) |

Gemini vision validates photos before accepting them (checks for real person, professional quality, correct identity).

---

## Testing

The project uses Vitest with **439 passing tests** across **27 test files** in `server/*.test.ts`. Run with:
```bash
pnpm test
```

Key test files:
- `server/llm.test.ts` — Vendor registry, model lookup, recommendation engine
- `server/dependencies.test.ts` — Dependency registry data structure
- `server/healthCheck.test.ts` — Health check procedures
- `server/avatarResolution.test.ts` — Avatar waterfall resolution
- `server/socialStats.test.ts` — Social stats enrichment
- `server/auth.logout.test.ts` — Auth flow (reference sample)
- `server/lib/authorAvatars/googleImagenGeneration.test.ts` — Google Imagen generation

---

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server (tsx watch) |
| `pnpm build` | Production build (Vite + esbuild) |
| `pnpm test` | Run Vitest tests |
| `pnpm db:push` | Generate + run Drizzle migrations |
| `pnpm format` | Prettier formatting |

---

## Routes

| Path | Component | Auth |
|---|---|---|
| `/` | `Home.tsx` | Public |
| `/author/:slug` | `AuthorDetail.tsx` | Public |
| `/book/:slug` | `BookDetail.tsx` | Public |
| `/compare` | `AuthorCompare.tsx` | Public |
| `/leaderboard` | `Leaderboard.tsx` | Public |
| `/admin` | `Admin.tsx` | Protected (admin role) |
| `/404` | `NotFound.tsx` | Public |

---

## Design Rules (Absolute)

These rules apply to all UI work on this project:

1. **Zero hardcoded colors** — No hex, rgb, rgba, or hsl literals in components. All colors from CSS variable tokens (`bg-card`, `text-foreground`, `border-border`, etc.).
2. **Category identity via icon + label only** — No colored stripes or tinted backgrounds (except in Manus/Norfolk AI themes where border stripes are allowed).
3. **Top-justified card content** — All card content starts at the top (`flex-col`, `items-start`).
4. **Business-like monocolor icons** — All icons are single-color. Add subtle hover animation to interactive icons.
5. **3-hotspot interaction model** — Every card has exactly 3 clickable areas (avatar/name, cover/title, card surface). Everything else is presentational.
6. **Amazon-first for book covers** — Always scrape Amazon before falling back to Google Books or other sources.
7. **AI Model selection** — Present vendors as a dropdown, models as radio buttons. Primary + optional Secondary LLM. Auto-Recommend button per task.
8. **Content categorization** — Authors' content is categorized into Books, Papers, and Articles.
9. **Manus theme is the seed** — Always update the Manus theme first when making design changes. Other themes branch from it.
10. **Avatar background color** — Default is Norfolk AI Teal `#0091AE`. Swatches use the official Norfolk AI palette.
11. **Flowbite is removed** — `FlowbiteAuthorCard` is named for historical reasons but no longer imports from `flowbite-react`. Use shadcn/ui Dialog for modals.
12. **Three.js for decorative only** — `FloatingBooks` is purely decorative. Do not add interactive 3D elements.
13. **Sidebar open by default** — `SidebarProvider defaultOpen={true}` in Home.tsx.
14. **AppSettingsContext is the theme authority** — `ThemeContext.tsx` has been removed. Use `useAppSettings()` from `AppSettingsContext.tsx` for theme state. The `useThemeCompat()` export provides a backward-compatible `appTheme`/`theme`/`toggleTheme` API.

---

## Skills Reference

The following skills document reusable patterns from this project:

| Skill | Purpose |
|---|---|
| `library-content-enrichment` | Full enrichment pipeline: photo waterfall, cover scraping, bio fetching |
| `book-cover-scrape-mirror` | Amazon scrape + S3 mirror batch script |
| `webdev-apify-scraping` | Apify cheerio-scraper integration pattern |
| `webdev-card-system` | Card + modal + accordion component system |
| `webdev-flowbite` | Flowbite + Tailwind v4 integration (historical; Flowbite removed from this project) |
| `webdev-theme-aware-cards` | Multi-theme card styling (Manus, Norfolk AI, Noir Dark) |
| `webdev-norfolk-ai-branding` | "Powered by Norfolk AI" badge |
| `webdev-page-header` | Breadcrumb navigation bar |
| `webdev-visualizations` | Charts and diagrams (ECharts, Nivo, React Flow) |
| `drive-media-folders` | Google Drive media folder management |
| `data-dedup-normalizer` | Entity deduplication and name normalization |
| `llm-recommendation-engine` | Multi-vendor LLM catalogue + task-based recommendation |
| `author-avatar-terminology` | Avatar source terminology and waterfall tier naming |
| `avatar-background-consistency` | Avatar background color rules |
| `avatar-photo-recency` | Avatar photo recency and quality standards |

---

## Project Skills (Local)

These skills are stored in `/home/ubuntu/skills/` and are specific to this project:

| Skill | File | Purpose |
|---|---|---|
| `llm-recommendation-engine` | `SKILL.md` | 13-vendor catalogue, recommendation engine, use cases |
| `author-avatar-terminology` | `SKILL.md` | Avatar source types, waterfall tier naming conventions |
| `avatar-background-consistency` | `SKILL.md` | Background color rules for AI-generated avatars |
| `avatar-photo-recency` | `SKILL.md` | Photo quality and recency standards |

> **Router split note:** The former monolithic `authorProfiles.router.ts` was split into 4 routers. Skill references to `authorProfiles.router.ts` for avatar/enrichment/social procedures now apply to `authorAvatar.router.ts`, `authorEnrichment.router.ts`, and `authorSocial.router.ts` respectively.

> **LLM catalogue note:** The vendor catalogue data was extracted from `llm.router.ts` into `server/lib/llmCatalogue.ts`. The router file is now ~133 lines (down from ~1006). Import catalogue types and data from `server/lib/llmCatalogue.ts`.

> **libraryData note:** Static constants (CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS, etc.) were extracted into `client/src/lib/libraryConstants.ts`. `libraryData.ts` re-exports them for backward compatibility. New code should import constants from `libraryConstants.ts` directly.
