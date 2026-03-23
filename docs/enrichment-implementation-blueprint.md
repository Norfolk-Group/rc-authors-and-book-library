# Library Enrichment System — Full Implementation Blueprint
## Claude Opus Architecture Report · March 22, 2026

> **Scope:** 27 new enrichment categories, complete N+1 LLM pipeline sequences, per-card and Admin Console UX design, automated scheduling with user-configurable intervals, and a Favorites priority-refresh system.

---

## Table of Contents

1. [Section A — LLM Tech Sequences (N+1 Pipelines)](#section-a)
2. [Section B — Per-Card UI/UX Design](#section-b)
3. [Section C — Admin Console Batch UI/UX Design](#section-c)
4. [Section D — Freshness, Scheduling & Favorites Architecture](#section-d)
5. [Section E — Implementation Roadmap](#section-e)

---

## Section A — LLM Tech Sequences (N+1 Pipelines) {#section-a}

Every enrichment workflow follows the same **N+1 waterfall pattern** already established in the codebase: a deterministic primary source (N), a fallback (N+1), an LLM synthesis step (N+2) that normalizes and structures the raw data, and an optional S3 mirror step for media assets. The model at each synthesis step is chosen by cost-to-quality ratio — Gemini Flash for simple extraction, Claude/Gemini Sonnet for reasoning-heavy tasks.

### A.1 Author Enrichment Pipelines

| Category | Step 1 — Primary Source | Step 2 — Fallback | Step 3 — LLM Synthesis | Step 4 — S3/Storage | Staleness Threshold | Cost Notes |
|----------|------------------------|-------------------|------------------------|---------------------|---------------------|------------|
| **Substack Profile** | `substack.com/{slug}` scrape → subscriber count, post frequency, recent titles | Substack Leaderboard cross-reference; Perplexity: "Substack newsletter by {author}" | Gemini Flash: "Extract: publicationName, subscriberCount, postFrequency, recentPosts[5], topicFocus. Output JSON." | None | 30 days | Free scrape; Perplexity: $0.001/req |
| **YouTube Channel** | YouTube Data API v3: `channels?forUsername={name}` → channelId, subscriberCount, viewCount | YouTube search: `{author name} official channel` → filter verified channels | Gemini Flash: "Verify this is the author's official channel. Extract: channelId, subscriberCount, totalViews, topVideo{title, views, url}, uploadFrequency. Output JSON." | Mirror channel thumbnail to S3 | 30 days | YouTube API: 10K units/day free |
| **TED/TEDx Talks** | `ted.com/speakers/{slug}` scrape → talk list, view counts | YouTube API: `search?q="{author}" TED talk&channelId=UCAuUUnT6oDeKwE6v1NGQxug` | Gemini Flash: "Extract all talks. For each: title, event (TED/TEDx/TEDSalon), date, viewCount, duration, url, thumbnailUrl. Output JSON array sorted by views desc." | Mirror thumbnails to S3 | 90 days | Free scrape; YouTube API free tier |
| **Speaking Bureau** | WSB, CAA, BigSpeak, APB profile pages scrape | Google search: `"{author}" speaking bureau OR "book {author} to speak"` | Gemini Flash: "Extract: bureauName, bureauUrl, speakerProfileUrl, feeRange (e.g. '$100K–$200K'), topics[], availability (virtual/in-person/both). Output JSON." | None | 90 days | Apify: $0.50/1k pages |
| **Own Podcast** | Apple Podcasts Search API: `itunes.apple.com/search?term={author}&entity=podcast` | Spotify API: `search?q={author}&type=show`; ListenNotes: `search?q={author}&type=podcast` | Gemini Flash: "Verify this is the author's own show (not guest appearance). Extract: podcastName, episodeCount, rating, applePodcastsUrl, spotifyUrl, latestEpisodeDate, avgDuration. Output JSON." | None | 30 days | Apple API: free; Spotify: free tier |
| **Notable Podcast Appearances** | ListenNotes API: `search?q="{author}"&type=episode&sort_by_date=1` | Perplexity: "Best podcast episodes featuring {author}" | Claude Haiku: "Filter for substantive interviews (not just mentions). Rank by podcast reach. Extract top 10: podcastName, episodeTitle, date, listenUrl, estimatedListeners, topicsDiscussed[]. Output JSON." | None | 14 days | ListenNotes: 500 req/mo free |
| **Academic Affiliations** | Google Scholar: `scholar.google.com/citations?user={id}` → h-index, citations, institution | University faculty page scrape; Wikipedia infobox | Gemini Flash: "Extract: institution, department, role (Professor/Associate/Visiting), googleScholarUrl, hIndex, citationCount, researchAreas[]. Output JSON." | None | 365 days | Free |
| **Company Affiliations** | Crunchbase API: `people/{slug}` → founded/advisor roles | LinkedIn public profile (via Apify); Wikipedia | Claude Sonnet: "Extract company roles. For each: companyName, role (Founder/CEO/Advisor/Board), companyUrl, isActive, startYear, endYear, companyDescription (20 words). Output JSON array." | None | 90 days | Crunchbase: paid; Apify: $0.50/1k |
| **Awards & Rankings** | Thinkers50: `thinkers50.com/thinkers/{slug}` | Forbes lists; Fast Company; Harvard Business Review | Gemini Flash: "Extract awards and rankings. For each: awardName, awardingBody, year, rank (if applicable), category, url. Output JSON array sorted by prestige." | None | 365 days | Free scrape |
| **Recent News Mentions** | NewsAPI: `everything?q="{author}"&sortBy=publishedAt&from={30daysAgo}` | Google News RSS: `news.google.com/rss/search?q={author}` | Gemini Flash: "Filter for substantive mentions (not just name drops). Extract top 10: headline, source, publishedAt, url, sentiment (positive/neutral/negative), topic (book launch/award/controversy/speaking). Output JSON." | None | 7 days | NewsAPI: 100 req/day free |
| **Newspaper/Magazine Columns** | Author's website scrape → links to external publications | Google search: `site:nytimes.com OR site:wsj.com OR site:theatlantic.com "{author}"` | Gemini Flash: "Extract regular columns or contributor roles. For each: publication, columnName (if any), url, isActive, frequency, startYear. Output JSON." | None | 90 days | Free; paywalls limit depth |
| **Instagram** | Instagram Basic Display API (if approved) | Apify Instagram scraper | Gemini Flash: "Extract: handle, followerCount, followingCount, postCount, avgLikesPerPost, topHashtags[], accountType (personal/business). Output JSON." | None | 30 days | Meta API: approval required |

### A.2 Book Enrichment Pipelines

| Category | Step 1 — Primary Source | Step 2 — Fallback | Step 3 — LLM Synthesis | Step 4 — S3/Storage | Staleness Threshold | Cost Notes |
|----------|------------------------|-------------------|------------------------|---------------------|---------------------|------------|
| **Official Book Microsite** | Pattern check: `{authorname}.com/{booktitle}`, `{booktitle}.com` | Google search: `"{book title}" official website OR "official book site"` | Gemini Flash: "Verify this is the official book site (not a review or retailer). Extract: micrositeUrl, hasWorkbook, hasAssessment, hasCourse, hasDownloads, companionResourceUrls[]. Output JSON." | None | 180 days | Free |
| **Companion Materials** | Book microsite scrape (from above) | Publisher website: PRH, HarperCollins, Simon & Schuster book pages | Gemini Flash: "Extract downloadable/companion resources. For each: resourceType (workbook/template/assessment/course), title, url, isFree, format (PDF/video/interactive). Output JSON." | None | 90 days | Free |
| **Book Club Guide** | Publisher website: `penguinrandomhouse.com/books/{id}` → reading guide section | LibraryThing, Goodreads reading guides | Gemini Flash: "Extract or synthesize 10 discussion questions appropriate for a business book club. Format as: questions[], themes[], suggestedActivities[], estimatedDiscussionTime. Output JSON." | None | Never (generated once) | Gemini Flash: ~$0.001/book |
| **Audiobook Data** | Audible: `audible.com/search?keywords={isbn}` → ASIN, narrator, duration, rating | Apple Books; Google Play Books; Libro.fm | Gemini Flash: "Extract: audibleAsin, narrator, isAuthorNarrated, durationMinutes, audiobookRating, audiobookRatingCount, audibleUrl, libroFmUrl, isUnabridged, hasAbridgedVersion. Output JSON." | None | 90 days | Apify: $0.50/1k pages |
| **Bestseller Rankings** | NYT Books API: `api.nytimes.com/svc/books/v3/lists/best-sellers/history.json?title={title}` | Publishers Weekly; USA Today bestseller lists | Gemini Flash: "Summarize bestseller performance. Extract: nytListName, nytPeakPosition, nytWeeksOnList, nytPeakDate, wsjBestseller, usaTodayBestseller, otherLists[]. Output JSON." | None | 7 days | NYT API: 500 req/day free |
| **Translation Count** | WorldCat API: `search?q={title}&author={author}` → language editions | Perplexity: "How many languages has {book title} been translated into?" | Claude Haiku: "Count unique translations. Extract: translationCount, languages[] (top 10 by market size), notableEditions[{language, localTitle, publisher}]. Output JSON." | None | 365 days | WorldCat: free non-commercial |
| **Format Availability** | Google Books API: `volumes?q=isbn:{isbn}` → isEbook, epub, pdf | Apify Amazon scrape → hardcover, paperback, Kindle, audio availability | Gemini Flash: "Catalog all formats. Extract: formats[{type, price, url, releaseDate}], isKindleUnlimited, isAudibleExclusive, upcomingFormats. Output JSON." | None | 30 days | Google Books: free |
| **Reading Time Estimate** | Calculate from `pageCount`: `estimatedMinutes = pageCount × 1.5` (avg adult reading speed 238 wpm × 250 words/page) | If no pageCount: Google Books API → pageCount; else Audible duration × 0.67 (listening vs. reading ratio) | Gemini Flash: "Given {pageCount} pages and {genre}, estimate reading time. Account for density (business books take longer than fiction). Output: { quickRead: minutes, normalPace: minutes, deepStudy: minutes, audiobook: minutes }." | None | Never (calculated field) | Free — local calculation |
| **Complexity/Difficulty Level** | Flesch-Kincaid readability via Google Books preview excerpt | LLM analysis of summary + Goodreads reviews mentioning "accessible" or "dense" | Claude Sonnet: "Rate complexity on three axes: (1) conceptual density 1–5, (2) vocabulary level 1–5, (3) prerequisite knowledge 1–5. Output: { overall: 'beginner'|'intermediate'|'advanced', conceptualDensity: n, vocabularyLevel: n, prerequisites: string[], recommendedFor: string, notRecommendedFor: string }." | None | Never (static analysis) | Claude Sonnet: $0.003/1k tokens |
| **Celebrity Endorsements** | Amazon product page scrape → "Editorial Reviews" section | Google search: `"{book title}" endorsed by OR "favorite book" OR "changed my life"` | Gemini Flash: "Extract celebrity/notable endorsements. For each: endorserName, endorserTitle, quoteExcerpt (50 words max), source (book jacket/interview/tweet), date. Output JSON array sorted by endorser reach." | None | 90 days | Apify: $0.50/1k pages |
| **Press Quotes** | Publisher website; Amazon "Editorial Reviews" | Goodreads "Quotes from reviews"; BookPage; Kirkus | Claude Haiku: "Extract press quotes. For each: publication, quote (under 30 words), reviewer (if named), rating (if given), fullReviewUrl, publicationTier (1=NYT/WSJ, 2=trade, 3=blog). Output JSON array max 10, sorted by tier." | None | 180 days | Free/minimal scraping |
| **Author Video About Book** | YouTube API: `search?q="{book title}" "{author}"&type=video` → filter for author-led content | Publisher YouTube channel; Author's own channel; TED (if talk matches book topic) | Gemini Flash: "Verify video is author-led discussion of THIS book. Extract: videoUrl, title, platform, duration, viewCount, isOfficialTrailer, isFullTalk, keyTimestamps[{topic, timeSeconds}]. Output JSON array." | Mirror thumbnails to S3 | 30 days | YouTube API: free tier |
| **Related Books** | Google Books API: `volumes?q=subject:{category}` → same category | Goodreads "Readers also enjoyed" scrape; StoryGraph similar books | Claude Sonnet: "Curate related books in 5 categories: (1) same author, (2) same topic different author, (3) cited in this book, (4) cites this book, (5) intellectual counterpoint. For each: title, author, relationship, isbn. Output JSON, max 5 per category." | None | 180 days | Claude Sonnet: $0.003/1k |
| **Podcast Episodes About Book** | ListenNotes API: `search?q="{book title}"&type=episode&sort_by_date=1` | Perplexity: "Podcast episodes discussing {book title} by {author}" | Gemini Flash: "Filter for substantive discussions (not just mentions). Extract top 15: podcastName, episodeTitle, date, duration, listenUrl, isAuthorGuest, discussionDepth ('summary'|'deep-dive'|'critique'). Output JSON." | None | 14 days | ListenNotes: 500 req/mo free |

### A.3 LLM Model Selection Guide

The pipeline uses three LLM tiers, selectable in Admin → AI Settings:

| Tier | Model | Use Case | Cost/1K tokens | Speed |
|------|-------|----------|----------------|-------|
| **Flash** | Gemini 2.5 Flash | Simple extraction, JSON formatting, verification | ~$0.0001 | Fast (1–2s) |
| **Haiku** | Claude 3 Haiku | Filtering, ranking, short synthesis | ~$0.0003 | Fast (1–2s) |
| **Sonnet** | Gemini 2.5 Pro / Claude Sonnet | Complex reasoning, curation, multi-axis analysis | ~$0.003 | Medium (3–8s) |

The primary and secondary LLM are configurable in Admin → AI Settings (per the existing AI Model Configuration pattern: vendor selector + model selector + primary/secondary switch).

---

## Section B — Per-Card UI/UX Design {#section-b}

### B.1 The Enrich Button (Both Card Types)

The enrichment entry point is a **hover-revealed Sparkles button** in the bottom-right corner of every author and book card. It is invisible at rest (`opacity-0`) and fades in on card hover (`opacity-100`, 150ms transition), keeping the card grid clean while remaining instantly discoverable.

```
Card at rest:              Card on hover:
┌──────────────────┐       ┌──────────────────┐
│                  │       │                  │
│   [Card content] │  →    │   [Card content] │
│                  │       │                  │
└──────────────────┘       └─────────────── ✦ ┘
                                           ↑ Sparkles button
```

The tooltip shows two lines: `"Enrich author data"` and `"67% complete · 3 fields stale"`. When enrichment is running, the icon switches to an animated `Loader2` spinner. When it completes, a brief `Check` icon flash (1.5 seconds) confirms success before returning to the default state.

### B.2 The Enrichment Drawer (Sheet Component, 480px)

Clicking the Enrich button opens a right-side Sheet with three zones:

**Header zone** — author avatar (or book cover) + name + a circular completeness ring showing the percentage of enriched fields (e.g., "67% · 12/18 fields"). A `Favorites` toggle switch sits below the header: "Prioritize for scheduled refresh." Toggling it adds the entity to the Favorites queue immediately.

**Completeness table** — an accordion-grouped checklist of all enrichment categories, organized by the same groups as the Admin Console (Platform Presence, Speaking & Events, Academic & Professional, etc.). Each row shows:

```
┌────────────────────────────────────────────────────────┐
│ ▼ Platform Presence                          3/4 ✓    │
├────────────────────────────────────────────────────────┤
│   ✓  YouTube Channel     2 days ago          [Run]    │
│   ✓  Substack           5 days ago          [Run]    │
│   ⚠  Instagram          32 days ago  STALE  [Run]    │
│   ✗  TED Talks          Never               [Run]    │
└────────────────────────────────────────────────────────┘
```

Status icons: `✓` green (fresh), `⚠` amber (stale, past threshold), `✗` grey (never run). Each row has an individual `[Run]` button. Two global buttons sit above the table: **"Enrich All Missing"** (primary, runs only `✗` rows) and **"Force Refresh All"** (outline, re-runs everything regardless of freshness).

**Real-time progress** — when any enrichment runs, the row's `[Run]` button becomes a spinner, and on completion the row flashes green briefly via a Framer Motion background animation before settling to the `✓` state.

### B.3 Freshness Dot on Cards

Every author avatar and book cover shows a **3×3px colored dot** in the bottom-right corner:

| Color | Meaning | Threshold |
|-------|---------|-----------|
| Green | All data fresh | All fields updated within 7 days |
| Amber | Some data stale | Any field between 7–30 days old |
| Red | Most data stale or missing | Any field older than 30 days, or >3 missing fields |

Hovering the dot shows a tooltip: `"Last enriched 3 days ago · 2 fields stale · Most stale: Instagram (32 days)"`.

### B.4 New Data Zones on Author Cards (Post-Enrichment)

After enrichment, the author card expands to show two new sections below the bio:

**Platform Presence row** — horizontal pill strip:
- `▶ 3 TED Talks` (red pill, links to TED profile)
- `▶ 2.1M YouTube` (red pill, links to channel)
- `📰 Weekly · 850K Substack` (blue pill, links to Substack)

**Professional row** — two badges:
- `🎓 Wharton Professor` (grey badge)
- `🎤 Speaking: $100K–$200K` (grey badge, links to bureau profile)

### B.5 New Data Zones on Book Cards (Post-Enrichment)

After enrichment, the book card shows three new elements:

- **Reading time pill** — `🕐 5.5 hr read` positioned below the star rating
- **Complexity badge** — `Accessible` / `Intermediate` / `Advanced` with color coding (green/amber/red)
- **Audiobook badge** — `🎧 Author-narrated · 5h 35m` below the content-type icons
- **Bestseller ribbon** — `#1 NYT · 250+ wks` gold ribbon overlaid on the top-left corner of the cover image

### B.6 Inline Quick Actions (No Drawer Required)

Three enrichments are so fast they can be triggered with a single click directly from the card, showing results in a small 240px popover:

- **"Calculate reading time"** — instant, pure calculation from `pageCount`, no API call
- **"Find on YouTube"** — single YouTube API call (~1 second), shows top result
- **"Check for TED talks"** — single TED scrape (~2 seconds), shows talk count

Each popover has a `"Save to profile"` button to persist the result to the database.

---

## Section C — Admin Console Batch UI/UX Design {#section-c}

### C.1 Reorganized Data Pipeline Tab

With 27 enrichment types, the current flat list of 3 ActionCards must be reorganized. The proposed structure uses **accordion groups** within the Data Pipeline tab, with a new **Scheduling** sub-tab and **Favorites** sub-tab added to the Admin Console tab bar.

```
Admin Console Tabs:
[Data Pipeline] [Research Cascade] [AI Settings] [Scheduling] [Favorites] [Settings] [About]
```

Within the Data Pipeline tab, accordion groups replace the flat list:

```
▼ Quick Actions (always expanded)
  [Regenerate DB]  [Enrich All Bios]  [Enrich All Books]

▼ Author Enrichment
  ▼ Platform Presence
    [YouTube]  [Substack]  [Instagram]
  ▼ Speaking & Events
    [TED Talks]  [Speaking Bureau]  [Own Podcast]  [Podcast Appearances]
  ▼ Academic & Professional
    [Academic Affiliations]  [Company Affiliations]  [Awards & Rankings]
  ▼ News & Media
    [Recent News]  [Newspaper Columns]

▼ Book Enrichment
  ▼ Core Data
    [Audiobook Data]  [Format Availability]  [Reading Time]  [Complexity Level]
  ▼ Discovery
    [Related Books]  [Podcast Episodes]  [Author Video]
  ▼ Social Proof
    [Celebrity Endorsements]  [Press Quotes]  [Bestseller Rankings]
  ▼ Resources
    [Book Microsite]  [Book Club Guide]  [Companion Materials]  [Translation Count]
```

### C.2 Enhanced ActionCard Design

Each ActionCard in the new groups extends the existing `ActionCard` component with five additions:

**Three run-mode buttons** (replacing the single "Run" button):

```
[Run All ▼]  →  dropdown:
  • Run All (100 items)
  • Run Stale Only (23 items)
  • Run Favorites First (12 favorites, then 88 standard)
```

**Estimated time** — `"~8 min for 100 authors"` shown in small text below the description, calculated from `avgItemTimeMs × pendingCount`.

**Item-level progress** — the progress bar message shows the current item: `"Processing Adam Grant (23/100)..."`.

**Cost estimate** — `"~$0.45 estimated API cost"` in `text-muted-foreground text-xs` below the description.

**Schedule shortcut** — a `"Set schedule →"` link in the card footer that jumps directly to the Scheduling tab with that enrichment type pre-selected.

### C.3 Scheduling Tab Design

The Scheduling tab uses a **two-column layout**: Standard Schedule (left) and Favorites Schedule (right). The Favorites column is always narrower and highlighted with a subtle amber border to indicate priority status.

**Global controls** (full-width bar at top):

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⏸ Pause All Schedules  [toggle]    ▶ Run All Now    📊 12 active  │
│  "No automatic enrichment while paused"                             │
│  Next scheduled run: YouTube in 2h 14m                             │
└─────────────────────────────────────────────────────────────────────┘
```

**Per-enrichment-type row** (repeated for all 27 types):

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▶ YouTube Channel                                          [on ●]  │
│                                                                      │
│  Standard:  [Monthly    ▼]   Favorites:  [Weekly     ▼]            │
│  Next run:  in 18 days       Next run:   in 3 days                  │
│  Last run:  5 days ago · 87 items · 2.3 min                         │
└──────────────────────────────────────────────────────────────────────┘
```

**Interval dropdown options** (same for both Standard and Favorites columns):

```
Manual Only | Daily | Every 3 Days | Weekly | Bi-weekly | Monthly | Quarterly
```

The Favorites interval defaults to approximately 3× more frequent than the Standard interval (e.g., if Standard = Monthly, Favorites defaults to Weekly).

**Slack notification settings** (bottom of Scheduling tab):

```
Slack Webhook URL: [https://hooks.slack.com/services/...]  [Test]

Notify on:  [x] Batch complete   [x] Batch failed
            [ ] Individual item failed   [ ] Stale items detected (>10)

Preview: "✅ YouTube enrichment complete · 87 authors updated · 2m 18s"
```

### C.4 Favorites Tab Design

The Favorites tab shows all starred authors and books with their enrichment status.

**Header summary bar:**
```
47 Favorites  ·  23 Authors  ·  24 Books  ·  Avg freshness: 78%
[Enrich Favorites Now]  [Add Favorites]  [Select All]  [Remove Selected]
```

**Favorites schedule card** (pinned at top):
```
┌────────────────────────────────────────────────────────────┐
│  ⭐ Favorites Refresh Schedule                             │
│                                                            │
│  Favorites refresh every:  [Every 3 days ▼]               │
│  Standard refresh every:   [Monthly      ▼]               │
│                                                            │
│  ℹ Favorites are always processed first in any batch run  │
│  Next favorites run: Tomorrow at 2:00 AM                  │
└────────────────────────────────────────────────────────────┘
```

**Favorites list** (two sub-tabs: Authors | Books):

Each row shows: thumbnail (avatar or cover) + name + last enriched date + freshness dot + individual "Enrich Now" button + star/remove button. Rows are sortable by name, last enriched date, or freshness score.

**Adding favorites** — the star icon on every author and book card in the main library view toggles favorite status. In the Admin Favorites tab, an "Add Favorites" button opens a search modal to find and star items in bulk.

---

## Section D — Freshness, Scheduling & Favorites Architecture {#section-d}

### D.1 Database Schema (Drizzle ORM)

Four new tables are required. All use the existing MySQL/TiDB connection.

```typescript
// drizzle/schema.ts — additions

import { mysqlTable, int, varchar, text, boolean, timestamp, json } from 'drizzle-orm/mysql-core';

// ── 1. Per-enrichment-type schedule configuration ──────────────────────────
export const enrichmentSchedules = mysqlTable('enrichment_schedules', {
  id:                    int('id').primaryKey().autoincrement(),
  enrichmentType:        varchar('enrichment_type', { length: 64 }).notNull().unique(),
  // Standard schedule
  standardIntervalDays:  int('standard_interval_days').notNull().default(30),
  standardLastRunAt:     timestamp('standard_last_run_at'),
  standardNextRunAt:     timestamp('standard_next_run_at'),
  standardIsEnabled:     boolean('standard_is_enabled').notNull().default(true),
  // Favorites schedule (runs before standard)
  favoritesIntervalDays: int('favorites_interval_days').notNull().default(7),
  favoritesLastRunAt:    timestamp('favorites_last_run_at'),
  favoritesNextRunAt:    timestamp('favorites_next_run_at'),
  favoritesIsEnabled:    boolean('favorites_is_enabled').notNull().default(true),
  // Metadata
  avgItemDurationMs:     int('avg_item_duration_ms'),       // rolling average for ETA display
  lastBatchItemCount:    int('last_batch_item_count'),
  lastBatchResult:       varchar('last_batch_result', { length: 255 }),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
  updatedAt:             timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// ── 2. User-favorited authors and books ────────────────────────────────────
export const favorites = mysqlTable('favorites', {
  id:              int('id').primaryKey().autoincrement(),
  entityType:      varchar('entity_type', { length: 16 }).notNull(),  // 'author' | 'book'
  entityId:        int('entity_id').notNull(),
  entityName:      varchar('entity_name', { length: 255 }).notNull(), // denormalized for display
  addedAt:         timestamp('added_at').notNull().defaultNow(),
  lastEnrichedAt:  timestamp('last_enriched_at'),
  nextEnrichAt:    timestamp('next_enrich_at'),
  priority:        int('priority').notNull().default(0),              // higher = processed first
  notes:           text('notes'),                                     // user notes
});

// ── 3. Enrichment job queue ────────────────────────────────────────────────
export const enrichmentJobs = mysqlTable('enrichment_jobs', {
  id:              int('id').primaryKey().autoincrement(),
  jobType:         varchar('job_type', { length: 64 }).notNull(),     // e.g. 'youtube', 'ted-talks'
  entityType:      varchar('entity_type', { length: 16 }).notNull(),  // 'author' | 'book'
  entityId:        int('entity_id').notNull(),
  entityName:      varchar('entity_name', { length: 255 }).notNull(),
  status:          varchar('status', { length: 16 }).notNull().default('pending'),
                   // 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  triggeredBy:     varchar('triggered_by', { length: 32 }).notNull(),
                   // 'manual' | 'schedule' | 'favorites-schedule' | 'per-card'
  isFavorite:      boolean('is_favorite').notNull().default(false),
  startedAt:       timestamp('started_at'),
  completedAt:     timestamp('completed_at'),
  durationMs:      int('duration_ms'),
  result:          text('result'),                                     // JSON summary
  errorMessage:    text('error_message'),
  retryCount:      int('retry_count').notNull().default(0),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
});

// ── 4. Per-entity per-type enrichment timestamps (granular staleness) ──────
export const enrichmentTimestamps = mysqlTable('enrichment_timestamps', {
  id:              int('id').primaryKey().autoincrement(),
  entityType:      varchar('entity_type', { length: 16 }).notNull(),
  entityId:        int('entity_id').notNull(),
  enrichmentType:  varchar('enrichment_type', { length: 64 }).notNull(),
  lastEnrichedAt:  timestamp('last_enriched_at').notNull(),
  dataHash:        varchar('data_hash', { length: 64 }),              // SHA-256 of result JSON
  fieldCount:      int('field_count'),                                // how many fields were populated
  // Composite unique index: (entityType, entityId, enrichmentType)
});
```

### D.2 Staleness Scoring Algorithm

```typescript
// shared/staleness.ts

export interface StalenessReport {
  score: number;           // 0–100 (100 = fully fresh)
  staleFields: string[];
  freshFields: string[];
  missingFields: string[];
  oldestField: { type: string; lastUpdated: Date } | null;
  freshnessColor: 'green' | 'amber' | 'red';
}

// Weight map: higher weight = more impact on staleness score
const FIELD_WEIGHTS: Record<string, number> = {
  // High-frequency fields (news, social)
  'recent-news':          10,
  'podcast-appearances':   8,
  'youtube':               6,
  'substack':              6,
  // Medium-frequency fields
  'ted-talks':             4,
  'speaking-bureau':       4,
  'audiobook':             4,
  'bestseller-rankings':   4,
  'related-books':         3,
  'podcast-episodes':      3,
  // Low-frequency / static fields
  'academic-affiliations': 2,
  'awards':                2,
  'complexity-level':      1,
  'reading-time':          1,
  'translation-count':     1,
  'book-microsite':        1,
  'isbn':                  0,  // never stale
};

// Staleness thresholds per field type (days)
const STALE_THRESHOLDS: Record<string, number> = {
  'recent-news':          7,
  'podcast-episodes':    14,
  'youtube':             30,
  'substack':            30,
  'ted-talks':           90,
  'speaking-bureau':     90,
  'audiobook':           90,
  'bestseller-rankings':  7,
  'academic-affiliations': 365,
  'awards':              365,
  'complexity-level':    Infinity,  // never stale
  'reading-time':        Infinity,
  'translation-count':   365,
};

export function computeStalenessScore(
  timestamps: Array<{ enrichmentType: string; lastEnrichedAt: Date }>,
  allTypes: string[]
): StalenessReport {
  const now = Date.now();
  const timestampMap = new Map(timestamps.map(t => [t.enrichmentType, t.lastEnrichedAt]));

  let totalWeight = 0;
  let freshWeight = 0;
  const staleFields: string[] = [];
  const freshFields: string[] = [];
  const missingFields: string[] = [];
  let oldestField: { type: string; lastUpdated: Date } | null = null;

  for (const type of allTypes) {
    const weight = FIELD_WEIGHTS[type] ?? 2;
    const threshold = STALE_THRESHOLDS[type] ?? 30;
    totalWeight += weight;

    const lastUpdated = timestampMap.get(type);
    if (!lastUpdated) {
      missingFields.push(type);
      continue;
    }

    const ageInDays = (now - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays <= threshold) {
      freshWeight += weight;
      freshFields.push(type);
    } else {
      staleFields.push(type);
    }

    if (!oldestField || lastUpdated < oldestField.lastUpdated) {
      oldestField = { type, lastUpdated };
    }
  }

  const score = totalWeight > 0 ? Math.round((freshWeight / totalWeight) * 100) : 0;
  const freshnessColor = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';

  return { score, staleFields, freshFields, missingFields, oldestField, freshnessColor };
}
```

### D.3 Cron Job Architecture

```typescript
// server/cron/enrichmentCron.ts
// Runs every hour via node-cron; checks enrichmentSchedules table;
// processes favorites first, then standard queue.

import cron from 'node-cron';
import { getDb } from '../db';
import { enrichmentSchedules, favorites, enrichmentJobs } from '../../drizzle/schema';
import { notifyOwner } from '../_core/notification';

// Concurrency limits per enrichment type to avoid API rate collisions
const CONCURRENCY: Record<string, number> = {
  'youtube':    2,   // YouTube API: 10K units/day, batch carefully
  'substack':   5,   // Simple scrape
  'ted-talks':  5,   // Simple scrape
  'news':      10,   // NewsAPI: 100 req/day free — serialize
  default:      3,
};

export function startEnrichmentCron() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    const db = await getDb();
    if (!db) return;

    const now = new Date();

    // 1. Find all enrichment types due for a run
    const dueSchedules = await db
      .select()
      .from(enrichmentSchedules)
      .where(
        and(
          eq(enrichmentSchedules.standardIsEnabled, true),
          lte(enrichmentSchedules.standardNextRunAt, now)
        )
      );

    for (const schedule of dueSchedules) {
      // 2. Build work queue: favorites first (sorted by priority desc),
      //    then all remaining entities sorted by staleness score desc
      const favoriteEntities = await db
        .select()
        .from(favorites)
        .orderBy(desc(favorites.priority));

      const allEntities = await getEntitiesForType(schedule.enrichmentType);

      // Deduplicate: favorites appear first, then non-favorites
      const favoriteIds = new Set(favoriteEntities.map(f => `${f.entityType}:${f.entityId}`));
      const standardEntities = allEntities.filter(
        e => !favoriteIds.has(`${e.entityType}:${e.entityId}`)
      );

      const workQueue = [...favoriteEntities, ...standardEntities];

      // 3. Process queue with concurrency limit
      const concurrency = CONCURRENCY[schedule.enrichmentType] ?? CONCURRENCY.default;
      const results = await processWithConcurrency(workQueue, concurrency, schedule.enrichmentType);

      // 4. Update schedule: set lastRunAt, compute nextRunAt
      await db.update(enrichmentSchedules)
        .set({
          standardLastRunAt: now,
          standardNextRunAt: new Date(now.getTime() + schedule.standardIntervalDays * 86400000),
          lastBatchItemCount: results.total,
          lastBatchResult: `${results.done} done, ${results.failed} failed`,
          avgItemDurationMs: results.avgDurationMs,
        })
        .where(eq(enrichmentSchedules.enrichmentType, schedule.enrichmentType));

      // 5. Slack notification
      const emoji = results.failed > 0 ? '⚠️' : '✅';
      await notifyOwner({
        title: `${emoji} ${schedule.enrichmentType} enrichment complete`,
        content: `${results.done}/${results.total} items processed · ${results.failed} failed · ${(results.totalDurationMs / 1000).toFixed(1)}s`,
      });
    }
  });
}
```

### D.4 New tRPC Procedures

All scheduling and favorites procedures are `adminProcedure` (require admin role). The `favorites.list` procedure is `protectedProcedure` so any logged-in user can see their favorites.

| Procedure | Type | Input | Output | Side Effects |
|-----------|------|-------|--------|--------------|
| `enrichmentSchedules.getAll` | adminProcedure query | — | `EnrichmentSchedule[]` | None |
| `enrichmentSchedules.update` | adminProcedure mutation | `{ enrichmentType, standardIntervalDays, favoritesIntervalDays, isEnabled }` | `{ success: boolean }` | Recomputes `nextRunAt` |
| `enrichmentSchedules.pauseAll` | adminProcedure mutation | `{ paused: boolean }` | `{ count: number }` | Sets all `isEnabled = !paused` |
| `favorites.add` | protectedProcedure mutation | `{ entityType, entityId, entityName, priority? }` | `Favorite` | Triggers immediate freshness check |
| `favorites.remove` | protectedProcedure mutation | `{ id }` | `{ success: boolean }` | None |
| `favorites.list` | protectedProcedure query | `{ entityType? }` | `FavoriteWithStaleness[]` | None |
| `favorites.enrichNow` | adminProcedure mutation | `{ ids?: number[] }` | `{ queued: number }` | Inserts jobs into `enrichmentJobs` |
| `enrichmentJobs.getRecent` | adminProcedure query | `{ limit?: number }` | `EnrichmentJob[]` | None |
| `enrichmentJobs.getActive` | adminProcedure query | — | `EnrichmentJob[]` | None — used for live progress polling |
| `enrichmentTimestamps.getForEntity` | publicProcedure query | `{ entityType, entityId }` | `EnrichmentTimestamp[]` | None — used by per-card drawer |
| `enrichmentTimestamps.getStalenessScore` | publicProcedure query | `{ entityType, entityId }` | `StalenessReport` | None — used by freshness dot |

---

## Section E — Implementation Roadmap {#section-e}

### Phase 1 — Foundation (Week 1–2)

Before any new enrichment type can be added, the infrastructure must be in place. This phase has no user-visible features but enables everything else.

1. Add the four new DB tables (`enrichmentSchedules`, `favorites`, `enrichmentJobs`, `enrichmentTimestamps`) and run `pnpm db:push`.
2. Implement `computeStalenessScore` in `shared/staleness.ts`.
3. Add the 9 new tRPC procedures listed in D.4.
4. Add the Favorites toggle (star icon) to author and book cards.
5. Add the Scheduling and Favorites tabs to the Admin Console.
6. Implement `startEnrichmentCron` in `server/cron/enrichmentCron.ts`.

### Phase 2 — Quick Win Enrichments (Week 3–4)

Implement the 9 Phase 1 enrichment types from the strategy report, all using free APIs:

Reading Time Estimate → TED/TEDx Talks → YouTube Channel → Own Podcast → Audiobook Data → Academic Affiliations → Author Video About Book → Format Availability → Complexity Level (LLM)

Each adds one new tRPC procedure (e.g., `authorProfiles.enrichYouTube`), one new ActionCard in the Admin Console, and populates the `enrichmentTimestamps` table on completion.

### Phase 3 — Per-Card Enrichment Drawer (Week 5–6)

Build the `EnrichmentDrawer` component (Sheet, 480px) with the completeness ring, accordion table, and real-time progress. Wire it to the Sparkles button on both card types. Add freshness dots to all cards.

### Phase 4 — Medium Enrichments (Week 7–10)

Implement the 9 Phase 2 enrichment types: Substack, podcast appearances, news mentions, awards, book club guide, celebrity endorsements, press quotes, related books, podcast episodes about book.

### Phase 5 — Complex Enrichments (Month 3–4)

Company affiliations (Crunchbase), NYT bestseller history, official book microsites, speaking bureau data, translation counts.

---

*Blueprint generated by Claude Opus 4.5 · Assembled by Manus AI · March 22, 2026*
