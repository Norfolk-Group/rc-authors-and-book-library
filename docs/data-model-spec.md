# Authors & Books Library — Data Model Specification

**Version:** 1.0 · **Date:** March 2026 · **Status:** Current + Proposed Expansion

---

## 1. Purpose

This document describes every field currently tracked per author and per content item in the NCG Library application, explains the enrichment source for each field, and proposes the expanded content-type model that will allow authors to be associated with any form of creative or intellectual output — not just books.

---

## 2. What We Currently Track

### 2.1 Author Profile (`author_profiles` table)

An author profile is the central record for every person in the library. It is keyed by the author's clean base name (e.g., `"Adam Grant"`) and enriched progressively across multiple automated pipelines.

#### Identity & Biography

| Field | Description | Enrichment Source |
|---|---|---|
| `authorName` | Clean display name (primary key) | Google Drive folder name |
| `bio` | Short 2–3 sentence biography | Wikipedia REST API |
| `richBioJson` | Full structured biography: `fullBio`, `professionalSummary`, `personalNote` | Perplexity LLM (double-pass) |
| `researchQuality` | Confidence level: `high` / `medium` / `low` | Computed during enrichment |
| `driveFolderId` | Google Drive folder ID for this author's assets | Drive scan |

#### Avatar & Visual Identity

| Field | Description | Enrichment Source |
|---|---|---|
| `avatarUrl` | Primary photo URL | Wikipedia → Tavily → Apify → AI fallback |
| `avatarSourceUrl` | Source page where the photo was found | Enrichment pipeline |
| `s3AvatarUrl` | CDN-mirrored copy on Manus S3 | Mirror pipeline |
| `s3AvatarKey` | S3 object key for deduplication | Mirror pipeline |
| `avatarSource` | Tier that provided the avatar: `wikipedia`, `tavily`, `apify`, `ai`, `google-imagen`, `drive` | Enrichment pipeline |
| `bestReferencePhotoUrl` | Best reference photo used during AI portrait generation | Tavily / Wikipedia |
| `authorDescriptionJson` | Physical appearance, style, personality — cached for AI avatar regeneration | LLM research stage |
| `lastAvatarPrompt` | Exact image generation prompt used for the current AI avatar | AI generation pipeline |
| `avatarGenVendor` / `avatarGenModel` | Which AI vendor/model generated the avatar | AI generation pipeline |
| `avatarResearchVendor` / `avatarResearchModel` | Which LLM performed the research stage | AI generation pipeline |
| `driveAvatarFileId` | Google Drive file ID for the stored avatar | Drive upload |

#### Social Media & Platform Links

| Field | Description | Enrichment Source |
|---|---|---|
| `twitterUrl` | Twitter / X profile URL | Wikidata P2002 / Perplexity |
| `linkedinUrl` | LinkedIn profile URL | Wikidata / Perplexity |
| `youtubeUrl` | YouTube channel URL | Wikidata P2397 / Perplexity |
| `instagramUrl` | Instagram profile URL | Wikidata P2003 / Perplexity |
| `tiktokUrl` | TikTok profile URL | Perplexity |
| `facebookUrl` | Facebook page URL | Wikidata / Perplexity |
| `githubUrl` | GitHub profile URL | Wikidata P2037 / Perplexity |
| `substackUrl` | Substack newsletter URL | Wikidata P4265 / URL inference |
| `mediumUrl` | Medium profile URL | URL inference / Perplexity |
| `podcastUrl` | Podcast show URL (Spotify, Apple Podcasts, own feed) | Perplexity |
| `blogUrl` | Personal blog URL | Perplexity |
| `newsletterUrl` | Email newsletter URL (Beehiiv, ConvertKit, Mailchimp) | Perplexity |
| `speakingUrl` | Speaking bureau or booking page | Perplexity |
| `businessWebsiteUrl` | Author's company or business website | Perplexity |
| `websiteUrl` | Primary personal website | Wikipedia / Wikidata P856 |
| `wikipediaUrl` | Wikipedia article URL | Wikipedia REST API |
| `stockTicker` | Public company ticker symbol (e.g., `AAPL` for Tim Cook) | Manual / Wikidata |
| `websitesJson` | Full structured list of all named websites: `[{label, url, type}]` | Perplexity |

#### Social Statistics

| Field | Description | Enrichment Source |
|---|---|---|
| `socialStatsJson` | Per-platform follower/view counts: GitHub, Substack, YouTube, Twitter, LinkedIn, Instagram, TikTok, Facebook | Platform APIs |
| `socialStatsEnrichedAt` | When social stats were last fetched | Pipeline |
| `substackPostCount` | Number of published Substack posts | Substack public API |
| `substackSubscriberRange` | Subscriber range label (e.g., `10K–50K`) | Substack public API |
| `substackStatsEnrichedAt` | When Substack stats were last fetched | Pipeline |

#### Media Presence

| Field | Description | Enrichment Source |
|---|---|---|
| `mediaPresenceJson` | Structured presence data: YouTube channel stats, TED talk count/views, Substack subscriber estimate, podcast episode count, Masterclass course | Perplexity + platform APIs |
| `mediaPresenceEnrichedAt` | When media presence was last enriched | Pipeline |

#### Professional & Business Profile

| Field | Description | Enrichment Source |
|---|---|---|
| `professionalEntriesJson` | Resume-style career entries: `[{title, org, period, description, url}]` | Perplexity / Wikipedia |
| `professionalProfileJson` | Structured profile: roles, board seats, education, awards, company affiliations | Wikipedia / Wikidata / Apollo.io |
| `professionalProfileEnrichedAt` | When professional profile was last enriched | Pipeline |
| `businessProfileJson` | Business data: company, speaking topics, speaking fee range, awards, education, board memberships | Perplexity |
| `businessProfileEnrichedAt` | When business profile was last enriched | Pipeline |

#### Academic Research

| Field | Description | Enrichment Source |
|---|---|---|
| `academicResearchJson` | h-index, citation count, affiliations, top papers, book-related research papers | OpenAlex / Semantic Scholar |
| `academicResearchEnrichedAt` | When academic research was last enriched | Pipeline |

#### Web & Enterprise Impact

| Field | Description | Enrichment Source |
|---|---|---|
| `webTrafficJson` | Monthly visits, global rank, traffic sources for author's primary website | SimilarWeb API |
| `webTrafficEnrichedAt` | When web traffic was last enriched | Pipeline |
| `earningsCallMentionsJson` | SEC EDGAR filings, earnings call mentions, advisory roles, impact score | SEC EDGAR + Quartr API |
| `earningsCallMentionsEnrichedAt` | When enterprise impact was last enriched | Pipeline |

#### Articles & Links

| Field | Description | Enrichment Source |
|---|---|---|
| `newspaperArticlesJson` | Array of notable articles: `[{title, url, date, publication}]` | Perplexity / Tavily |
| `otherLinksJson` | Catch-all links: `[{label, url, type}]` | Manual / Perplexity |
| `platformEnrichmentStatus` | Per-platform enrichment tracking: `{youtube, ted, substack, ...}` | Pipeline |
| `lastLinksEnrichedAt` | When links were last enriched | Pipeline |
| `linksEnrichmentSource` | Which tool enriched the links: `perplexity`, `tavily`, `manual` | Pipeline |

#### Document Archive

| Field | Description | Enrichment Source |
|---|---|---|
| `documentArchiveJson` | Google Drive file metadata for all documents in the author's Drive folder | Google Drive API |
| `documentArchiveEnrichedAt` | When the document archive was last indexed | Pipeline |

---

### 2.2 Book Profile (`book_profiles` table)

A book profile represents a single published book, keyed by clean title. It is the only content type currently modelled as a first-class entity.

| Field | Description | Enrichment Source |
|---|---|---|
| `bookTitle` | Clean title (primary key) | Google Drive folder name |
| `authorName` | Author name (foreign key to `author_profiles.authorName`) | Drive scan |
| `summary` | 2–3 sentence summary | LLM (Gemini / Claude) |
| `keyThemes` | Comma-separated themes, e.g. `habits,productivity` | LLM |
| `rating` | Average rating out of 5 | Amazon / Goodreads |
| `ratingCount` | Number of ratings/reviews | Amazon / Goodreads |
| `publishedDate` | Publication date string | Google Books / Amazon |
| `isbn` | ISBN-13 | Google Books |
| `publisher` | Publisher name | Google Books |
| `publisherUrl` | Publisher's page for this book | Google Books |
| `amazonUrl` | Amazon product page URL | Apify scrape |
| `goodreadsUrl` | Goodreads book page URL | Goodreads |
| `wikipediaUrl` | Wikipedia article URL | Wikipedia |
| `resourceUrl` / `resourceLabel` | Single supplementary link + label | Manual |
| `resourceLinksJson` | Full array of resource links: `[{label, url, type}]` | Manual / enrichment |
| `coverImageUrl` | Book cover image URL | Amazon (priority) → Google Books |
| `s3CoverUrl` / `s3CoverKey` | CDN-mirrored cover on Manus S3 | Mirror pipeline |
| `coverImageSource` | Where the cover came from: `amazon`, `google_books`, `manual` | Pipeline |
| `richSummaryJson` | Full summary, key insights, notable quotes, similar books | LLM (double-pass) |
| `technicalReferencesJson` | Code references, GitHub repos, documentation links (technical books) | GitHub API + Context7 |
| `readingNotesJson` | Personal reading notes, highlights, status from Notion | Notion MCP |
| `driveFolderId` | Google Drive folder ID for this book's assets | Drive scan |

---

## 3. What Is Currently Missing

The current model has two significant gaps:

**Gap 1 — Content is book-only.** Every non-book output an author produces (Substack posts, podcasts, newspaper columns, films, TV appearances, academic papers, newsletters, etc.) is either stored as a URL field on the author record or lost entirely. There is no structured way to browse, search, filter, or enrich these items independently.

**Gap 2 — No CRUD from the UI.** Authors and books can only be added by scanning Google Drive. There is no form in the application to manually create, edit, or delete an author or a content item.

---

## 4. Proposed Expansion: Universal Content Model

### 4.1 Content Types

The expanded model introduces a single `content_items` table that can represent any type of intellectual or creative output. Every row belongs to one author and carries a `contentType` discriminator.

| Content Type Key | Examples |
|---|---|
| `book` | Published books (migrated from `book_profiles`) |
| `paper` | Academic papers, white papers, research reports (PDF-linkable) |
| `article` | Newspaper columns, magazine features, online articles (PDF-linkable) |
| `substack` | Individual Substack posts or the publication itself |
| `newsletter` | Email newsletter issues (Beehiiv, ConvertKit, Mailchimp) |
| `podcast` | Podcast shows or individual episodes |
| `podcast_episode` | Single podcast episode within a show |
| `youtube_video` | Individual YouTube videos |
| `youtube_channel` | YouTube channel (aggregated) |
| `ted_talk` | TED / TEDx talks |
| `masterclass` | Masterclass courses |
| `online_course` | Courses on Coursera, Udemy, Teachable, etc. |
| `tv_show` | Television series or documentary series |
| `tv_episode` | Individual TV episode |
| `film` | Feature film or documentary |
| `radio` | Radio show, radio interview, or audio broadcast |
| `photography` | Photography portfolio or individual photo series |
| `social_post` | Notable social media post (Twitter thread, LinkedIn essay) |
| `speech` | Keynote, commencement address, congressional testimony |
| `interview` | Published interview (print, audio, or video) |
| `blog_post` | Individual blog post |
| `website` | Author's website or micro-site |
| `tool` | Software tool, app, or framework created by the author |
| `other` | Catch-all for anything not covered above |

### 4.2 Universal Content Item Fields

Every content item, regardless of type, carries this common set of fields:

| Field | Description |
|---|---|
| `id` | Auto-increment primary key |
| `authorName` | Foreign key → `author_profiles.authorName` |
| `contentType` | One of the type keys above |
| `title` | Display title |
| `subtitle` | Optional subtitle or episode title |
| `description` | 2–3 sentence summary or description |
| `richDescriptionJson` | Full LLM-enriched description with key insights, quotes, themes |
| `url` | Primary URL (Amazon page, podcast feed, YouTube link, etc.) |
| `coverImageUrl` | Thumbnail or cover image URL |
| `s3CoverUrl` / `s3CoverKey` | CDN-mirrored cover |
| `publishedDate` | Publication / release date |
| `tagsJson` | User-defined and auto-generated tags: `string[]` |
| `rating` | Average rating (where applicable) |
| `ratingCount` | Number of ratings |
| `language` | ISO 639-1 language code |
| `driveFolderId` | Google Drive folder ID (if backed by Drive) |
| `readingNotesJson` | Personal notes, highlights, reading status (from Notion) |
| `resourceLinksJson` | Additional links: `[{label, url, type}]` |
| `enrichedAt` | When the record was last enriched |
| `createdAt` / `updatedAt` | Standard timestamps |

### 4.3 Type-Specific Extended Fields

Beyond the universal fields, each content type carries additional structured metadata stored in a `metadataJson` column:

| Content Type | Key Metadata Fields |
|---|---|
| `book` | `isbn`, `publisher`, `publisherUrl`, `amazonUrl`, `goodreadsUrl`, `wikipediaUrl`, `keyThemes`, `technicalReferencesJson` |
| `paper` | `doi`, `journal`, `institution`, `pdfUrl`, `citationCount`, `coAuthors` |
| `article` | `publication`, `pdfUrl`, `wordCount`, `section` (opinion, news, feature) |
| `podcast` / `podcast_episode` | `feedUrl`, `spotifyUrl`, `appleUrl`, `episodeCount`, `durationSeconds`, `showName` |
| `youtube_video` / `youtube_channel` | `channelId`, `videoId`, `viewCount`, `likeCount`, `subscriberCount` |
| `ted_talk` | `tedUrl`, `viewCount`, `eventName`, `year` |
| `film` / `tv_show` / `tv_episode` | `imdbUrl`, `streamingPlatform`, `releaseYear`, `director`, `cast`, `season`, `episode` |
| `masterclass` / `online_course` | `platform`, `courseUrl`, `lessonCount`, `durationHours`, `price` |
| `speech` | `eventName`, `venue`, `videoUrl`, `transcriptUrl` |
| `photography` | `platform` (Instagram, 500px, Flickr), `photoCount`, `portfolioUrl` |

### 4.4 Tagging System

Tags are first-class citizens. Every content item and every author profile can carry tags. Tags serve three purposes:

1. **Topic tags** — subject matter: `#leadership`, `#neuroscience`, `#startups`, `#climate`
2. **Format tags** — media type shorthand: `#long-form`, `#visual`, `#audio`, `#interactive`
3. **Status tags** — personal reading/consumption status: `#to-read`, `#reading`, `#completed`, `#recommended`

Tags are stored as a JSON string array (`tagsJson`) on both the author and content item records. A separate `tags` lookup table will power autocomplete and tag-cloud views.

### 4.5 CRUD Requirements

The application must allow authenticated users to perform the following operations from the UI:

**Authors:**
- Create a new author (name, bio, category, avatar upload, initial links)
- Edit any author field (bio, links, social URLs, tags)
- Delete an author (with confirmation, cascades to content items)

**Content Items:**
- Create a new content item for any author (type selector, title, URL, cover upload, tags)
- Edit any content item field
- Delete a content item (with confirmation)
- Bulk-tag multiple items at once

**Tags:**
- Create, rename, and delete tags from a tag management panel
- Apply and remove tags from authors and content items inline

---

## 5. Implementation Roadmap

The following phases are recommended for implementing the expanded model:

| Phase | Scope | Effort |
|---|---|---|
| **Phase 1** | Add CRUD forms for authors and books (current schema, no migration) | Small |
| **Phase 2** | Add `tags` table + `tagsJson` to both existing tables; tag UI | Small |
| **Phase 3** | Add `content_items` table; migrate `book_profiles` rows into it | Medium |
| **Phase 4** | Build content-type-aware create/edit forms with type-specific metadata | Medium |
| **Phase 5** | Enrich non-book content types (podcast stats, YouTube stats, IMDB data) | Large |

Phase 1 and Phase 2 can be implemented immediately without any breaking changes to the existing data model.

---

## 6. Summary Table

The table below consolidates the total field count across the current model and the proposed expansion.

| Entity | Current Fields | Proposed Additional Fields | Total |
|---|---|---|---|
| Author Profile | 58 | +5 (tags, category, nationality, birthYear, deathYear) | 63 |
| Book Profile | 24 | Migrated into `content_items` | — |
| Content Item (new) | — | 30 universal + ~10 type-specific | ~40 |
| Tag (new) | — | 5 (id, name, slug, color, usageCount) | 5 |

---

*Document maintained by the NCG Library engineering team. Last updated: March 2026.*
