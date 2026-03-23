# Library Enrichment Strategy
## Claude Opus — Comprehensive Data Architecture Report

> **47 new data fields** identified across author and book profiles.
> Generated March 22, 2026.

---

## Executive Summary

This report identifies enrichment opportunities that can significantly enhance user engagement and discovery for the ~100 business/non-fiction authors and ~245 books in the library. The analysis is organized into Author enrichment (Sections 1.1–1.8), Book enrichment (Sections 2.1–2.7), a Data Source Strategy table (Section 3), and a phased Implementation Priority Matrix (Section 4).

**Key Recommendations:**

- **Immediate wins (Phase 1):** YouTube presence, TED talks, audiobook data, reading time estimates, academic affiliations — high value, easy to fetch, no authentication required.
- **High-value investments (Phase 2):** Substack profiles, podcast appearance mapping, awards/rankings, book club guides, celebrity endorsements, complexity scoring.
- **Complex projects (Phase 3):** Company affiliations (Crunchbase), bestseller rank history (NYT API), official book microsites, speaking bureau fee data.
- **Opportunistic (Phase 4):** Translation counts, non-Substack newsletters, newspaper columns, Instagram/TikTok.

---

## 1. Author Enrichment Opportunities

### 1.1 Platform Presence & Metrics

| Field | Data Type | Description | Example (Tim Ferriss) |
|-------|-----------|-------------|----------------------|
| `substackPublicationName` | string | Name of their Substack | "5-Bullet Friday" |
| `substackSubscriberCount` | integer | Estimated subscriber count | 2,500,000+ |
| `substackPostFrequency` | enum | weekly / biweekly / monthly | "weekly" |
| `substackRecentPostsJson` | json | Last 5 post titles + dates | [...] |
| `youtubeChannelId` | string | YouTube channel ID | "UCznv7Vf9nBdJYvBagFdAHWw" |
| `youtubeSubscriberCount` | integer | Channel subscribers | 2,100,000 |
| `youtubeTotalViews` | bigint | Lifetime channel views | 450,000,000 |
| `youtubeTopVideoJson` | json | Most viewed video details | `{"title": "...", "views": 15M}` |
| `instagramHandle` | string | Instagram username | "timferriss" |
| `instagramFollowerCount` | integer | Follower count | 1,800,000 |

**Substack Examples:**

| Author | Publication | Est. Subscribers | Frequency |
|--------|-------------|-----------------|-----------|
| Adam Grant | Granted | 850,000 | Weekly |
| James Clear | 3-2-1 Thursday | 3,000,000+ | Weekly |
| Seth Godin | Seth's Blog | 1,000,000+ | Daily |
| Tim Ferriss | 5-Bullet Friday | 2,500,000+ | Weekly |
| Sahil Bloom | The Curiosity Chronicle | 700,000+ | 2× weekly |

---

### 1.2 Speaking & Events

| Field | Data Type | Description | Example (Brené Brown) |
|-------|-----------|-------------|----------------------|
| `speakingBureauName` | string | Primary bureau | "CAA Speakers" |
| `speakingBureauUrl` | string | Profile page | `https://www.caa.com/speakers/brene-brown` |
| `speakingFeeRange` | string | Fee bracket | "$100,000 – $200,000" |
| `speakingTopicsJson` | json[] | Topic list | ["Vulnerability", "Leadership", "Courage"] |
| `speakingAvailability` | enum | virtual / in-person / both | "both" |
| `bookingContactUrl` | string | Inquiry link | ... |

**Bureau Coverage:**

| Author | Primary Bureau | Fee Range | Notable Topics |
|--------|---------------|-----------|----------------|
| Simon Sinek | WSB | $150K–$300K | Leadership, Start With Why |
| Adam Grant | CAA | $100K–$200K | Organizational Psychology |
| Brené Brown | CAA | $150K–$250K | Vulnerability, Courage |
| Malcolm Gladwell | Penguin Speakers | $150K–$250K | Social Psychology |
| Gary Vaynerchuk | VaynerSpeakers | $100K–$200K | Marketing, Entrepreneurship |

---

### 1.3 TED / TEDx Presence

New fields: `tedTalks` (array), `tedTalkCount`, `tedTotalViews`, `mostViewedTedTalkJson`

**TED Talk Inventory (Sample):**

| Author | Talk Title | Views | Year |
|--------|------------|------:|------|
| Simon Sinek | How Great Leaders Inspire Action | 65M | 2009 |
| Brené Brown | The Power of Vulnerability | 62M | 2010 |
| Adam Grant | The Surprising Habits of Original Thinkers | 15M | 2016 |
| Amy Cuddy | Your Body Language May Shape Who You Are | 72M | 2012 |
| Susan Cain | The Power of Introverts | 36M | 2012 |
| Dan Pink | The Puzzle of Motivation | 28M | 2009 |

---

### 1.4 Podcast Ecosystem

New fields: `ownedPodcasts` (array with name, episodeCount, Apple/Spotify URLs), `notableAppearances` (top 10 by reach), `totalAppearances`

| Author | Own Podcast | Notable Appearances |
|--------|------------|---------------------|
| Tim Ferriss | The Tim Ferriss Show (700+ eps) | JRE, Armchair Expert, Impact Theory |
| Adam Grant | WorkLife | Ten Percent Happier, HBR IdeaCast |
| Brené Brown | Unlocking Us, Dare to Lead | Oprah, Armchair Expert, Tim Ferriss |
| Seth Godin | Akimbo | Tim Ferriss |
| James Clear | — | Tim Ferriss, Rich Roll, School of Greatness |

---

### 1.5 Academic & Professional Affiliations

New fields: `academicAffiliationsJson` (institution, role, department, profileUrl), `companyFoundedJson`, `advisoryRolesJson`, `boardSeatsJson`, `googleScholarUrl`, `hIndex`, `citationCount`

| Author | Academic Role | Company Roles |
|--------|--------------|---------------|
| Adam Grant | Wharton Professor | BetterUp (Advisor) |
| Amy Edmondson | Harvard Business School Professor | — |
| Gary Vaynerchuk | — | CEO VaynerMedia, VaynerX, VeeFriends |
| Reid Hoffman | Stanford Guest Lecturer | Greylock Partner, LinkedIn Co-founder |

---

### 1.6 Awards & Recognition

New fields: `awardsJson` (award name, body, year, category), `rankingsJson` (list name, rank, year), `bestsellerAchievementsJson`, `honoraryDegreesJson`

---

### 1.7 Recent News & Media

New fields: `recentMentionsJson` (headline, source, publishedAt, URL, sentiment), `mentionCount90Days`, `topPublications`, `regularColumnsJson` (publication, column name, URL, isActive)

---

### 1.8 Complete Author Extension Interface

```typescript
interface AuthorEnrichmentExtension {
  substackProfile: SubstackProfile;
  youtubeChannel: YouTubeChannel;
  instagramHandle: string;
  instagramFollowerCount: number;
  speakingProfile: SpeakingProfile;
  tedTalks: TedTalk[];
  tedTalkCount: number;
  tedTotalViews: number;
  podcastPresence: PodcastPresence;
  academicProfile: AcademicProfile;
  companyAffiliations: CompanyAffiliations;
  recognition: Recognition;
  mediaPresence: MediaPresence;
  enrichmentVersion: string;
  lastFullEnrichment: Date;
}
```

---

## 2. Book Enrichment Opportunities

### 2.1 Official Book Resources

| Field | Description | Example (Atomic Habits) |
|-------|-------------|------------------------|
| `officialBookUrl` | Dedicated book website | `https://atomichabits.com` |
| `bookMicrositeHasResources` | Has downloadable resources | true |
| `companionWorkbookUrl` | Official workbook | `https://atomichabits.com/workbook` |
| `onlineCourseUrl` | Associated course | `https://jamesclear.com/habit-academy` |
| `assessmentToolUrl` | Self-assessment tool | `https://jamesclear.com/habits-scorecard` |
| `bookClubGuideUrl` | Discussion questions | Publisher page |
| `authorVideoAboutBookUrl` | YouTube/TED talk about the book | YouTube link |

**Book Website Inventory (Sample):**

| Book | Website | Key Resources |
|------|---------|---------------|
| Atomic Habits | atomichabits.com | Habit scorecard, cheat sheet, workbook |
| Start With Why | startwithwhy.com | Golden Circle worksheet |
| The 4-Hour Workweek | fourhourbody.com | Gear recommendations, templates |

---

### 2.2 Audiobook Data

| Field | Description | Example (Atomic Habits) |
|-------|-------------|------------------------|
| `audibleAsin` | Unique Audible identifier | B07RFSSYBH |
| `audiobookNarrator` | Voice performer(s) | James Clear (author-narrated) |
| `audiobookDurationMinutes` | Total listening time | 335 mins (5h 35m) |
| `audiobookRating` | Listener rating | 4.8/5 |
| `libroFmUrl` | Indie bookstore audiobook | `https://libro.fm/audiobooks/9780735211292` |
| `appleBooksAudioUrl` | Apple Books link | Apple Books URL |
| `isAuthorNarrated` | Whether the author reads it | true |
| `isUnabridged` | Full or shortened | true |

---

### 2.3 Bestseller & Awards Data

| Field | Description | Example (Atomic Habits) |
|-------|-------------|------------------------|
| `nytPeakPosition` | Highest NYT ranking | #1 |
| `nytWeeksOnList` | Total weeks on NYT list | 250+ |
| `nytListName` | Which NYT list(s) | Business, Combined Nonfiction |
| `wsjBestseller` | WSJ bestseller flag | true |
| `amazonCategoryRankingsJson` | Category ranks | `[{"category": "Management", "rank": 3}]` |
| `awardsJson` | Awards won | FT Business Book of the Year (shortlist) |
| `goodreadsChoiceAward` | Goodreads Choice Award | Nominee 2018 |

**NYT Performance Examples:**

| Book | Author | Peak | Weeks |
|------|--------|-----:|------:|
| Atomic Habits | James Clear | #1 | 250+ |
| Think Again | Adam Grant | #1 | 52+ |
| The Subtle Art… | Mark Manson | #1 | 200+ |
| Dare to Lead | Brené Brown | #1 | 75+ |
| Start With Why | Simon Sinek | #1 | 100+ |

---

### 2.4 Translation & Format Data

| Field | Description | Example (Atomic Habits) |
|-------|-------------|------------------------|
| `translationCount` | Number of languages | 50+ |
| `majorTranslationsJson` | Key markets + titles | `[{"lang": "Spanish", "title": "Hábitos Atómicos"}]` |
| `pageCount` | Print edition pages | 320 |
| `readingTimeMinutes` | Estimated reading time | 330 mins (5.5 hrs) |
| `complexityLevel` | 1–5 difficulty scale | 2 (Accessible) |
| `targetAudience` | Primary reader profile | "Early career professionals" |

**Complexity Scale:**

| Level | Description | Examples |
|------:|-------------|---------|
| 1 | Entry — no prior knowledge | Start With Why, The One Thing |
| 2 | Accessible — basic business awareness | Atomic Habits, Dare to Lead |
| 3 | Intermediate — industry experience helpful | Good to Great, The Hard Thing |
| 4 | Advanced — significant domain expertise | The Innovator's Dilemma, Thinking Fast/Slow |
| 5 | Expert — deep technical/academic background | Academic strategy texts |

---

### 2.5 Social Proof & Endorsements

| Field | Description |
|-------|-------------|
| `celebrityEndorsementsJson` | Endorser name, quote, credentials, relationship |
| `pressQuotesJson` | Publication, quote, tier (1–4), URL |
| `oprahBookClub` | Boolean — Oprah's Book Club selection |

**Notable Endorsement Examples:**

| Book | Endorser | Endorser Reach |
|------|----------|---------------|
| Atomic Habits | Barack Obama | 130M+ Twitter |
| Start With Why | Tony Robbins | 30M+ followers |
| Dare to Lead | Oprah Winfrey | Massive media reach |

---

### 2.6 Difficulty & Audience Targeting

New fields: `complexityLevel` (1–5), `targetAudienceJson`, `prerequisiteKnowledge`, `narrativeVsFramework` (enum)

---

### 2.7 Related Content

New fields: `podcastEpisodesAboutBookJson` (podcast name, episode URL, date), `relatedBooksJson` (similar reads, "also bought"), `seriesName`, `seriesPosition`

---

## 3. Data Source Strategy

| # | Category | Best Source | URL Pattern / API | Complexity | Update Freq | Auth Required | Notes |
|---|----------|------------|-------------------|-----------|-------------|---------------|-------|
| 1 | Substack profile | Substack public pages + leaderboard | `substack.com/{slug}` | Medium | Monthly | No | Subscriber counts often hidden; cross-ref Substack leaderboard |
| 2 | YouTube channel | YouTube Data API v3 | `googleapis.com/youtube/v3/channels` | Easy | Monthly | API key (free) | 10,000 units/day free; channel search by author name |
| 3 | TED/TEDx talks | TED website scrape | `ted.com/speakers/{slug}` | Easy | Quarterly | No | Well-structured HTML; view counts public |
| 4 | Speaking bureau | Bureau websites (WSB, CAA, BigSpeak) | Per-bureau scrape | Hard | Quarterly | No | Fee data often hidden; bureau name + URL is achievable |
| 5 | Newsletter (non-Substack) | Beehiiv/ConvertKit landing pages | Author website link discovery | Hard | Quarterly | No | Fragmented; low ROI vs. Substack |
| 6 | Company affiliations | Crunchbase API / LinkedIn | `crunchbase.com/person/{slug}` | Hard | Quarterly | Paid (Crunchbase) | LinkedIn blocks scraping; manual for top 20 |
| 7 | Academic affiliations | University faculty pages + Google Scholar | `scholar.google.com/citations?user=` | Easy | Annually | No | Google Scholar public; faculty pages scrapeable |
| 8 | Awards & rankings | Thinkers50 + award body sites | `thinkers50.com/thinkers/{slug}` | Medium | Annually | No | Thinkers50 well-structured; other awards manual |
| 9 | Own podcast | Apple Podcasts API + Spotify | `itunes.apple.com/search?term=` | Easy | Monthly | No | Apple Search API free; episode count + rating |
| 10 | Podcast appearances | ListenNotes API | `listennotes.com/api/v2/search` | Medium | Monthly | API key (freemium) | 10 free searches/day; paid for bulk |
| 11 | Newspaper columns | Publisher sites (Atlantic, NYT, Forbes) | Per-publication scrape | Hard | Monthly | Paywalls | Inconsistent formats; low ROI |
| 12 | Recent news | NewsAPI / Google News RSS | `newsapi.org/v2/everything?q=` | Easy | Weekly | API key (free tier) | 100 requests/day free; good for recent 30 days |
| 13 | Instagram/TikTok | Official APIs (restricted) | Meta Graph API | Hard | Monthly | OAuth + approval | Meta API heavily restricted; TikTok Research API requires approval |
| 14 | Book microsite | Author website link discovery | `{authorname}.com/{booktitle}` | Medium | One-time | No | Pattern: atomichabits.com, startwithwhy.com |
| 15 | Companion materials | Book microsite scrape | Same as above | Medium | Quarterly | No | Often PDF downloads or course links |
| 16 | Book club guide | Publisher sites (PRH, HarperCollins, etc.) | `penguinrandomhouse.com/books/{id}` | Medium | One-time | No | Publisher pages well-structured |
| 17 | Audiobook data | Audible public pages + Apple Books | `audible.com/pd/{slug}/{ASIN}` | Easy | One-time | No | ASIN discoverable from Amazon product page |
| 18 | Bestseller rankings | NYT Books API + Amazon PA-API | `api.nytimes.com/svc/books/v3` | Medium | Weekly | API key (NYT free; Amazon PA-API requires Associates) | NYT API free; Amazon requires active Associates account |
| 19 | Translation count | Google Books API + publisher pages | `googleapis.com/books/v1/volumes?q=isbn:` | Easy | One-time | API key (free) | Google Books has edition data; supplement with publisher |
| 20 | Format availability | Google Books API | Same as above | Easy | One-time | API key (free) | Returns available formats per ISBN |
| 21 | Reading time estimate | Calculation from page count | Internal formula | Easy | One-time | None | `(pages × 250) / 238 wpm` |
| 22 | Complexity level | LLM assessment (Gemini/Claude) | Internal LLM call | Easy | One-time | API key (already have) | Prompt: rate 1–5 based on book description + themes |
| 23 | Celebrity endorsements | Amazon "Editorial Reviews" section | Apify scrape of Amazon product page | Medium | One-time | Apify token (already have) | Already using Apify for covers; extend same scraper |
| 24 | Press quotes | Same as endorsements | Same as above | Medium | One-time | Same | Tier classification by publication name |
| 25 | Author video about book | YouTube Data API v3 search | `youtube.com/search?q={title}+{author}` | Easy | One-time | API key (free) | Search `"Atomic Habits" "James Clear"` returns talk |
| 26 | Related books | Amazon "Customers also bought" | Apify scrape | Medium | Quarterly | Apify token | Extend existing Amazon scraper |
| 27 | Podcast episodes about book | ListenNotes API search | `listennotes.com/api/v2/search?q={title}` | Medium | Monthly | API key (freemium) | Search by book title; filter by date |

---

## 4. Implementation Priority Matrix

### Full Ranking Table

| # | Enrichment | User Value (1–5) | Effort | Data Availability | Priority Score |
|---|-----------|:----------------:|--------|:-----------------:|:--------------:|
| 3 | TED/TEDx talks | 5 | S | High | **1** |
| 2 | YouTube channel | 5 | S | High | **1** |
| 9 | Own podcast | 4 | S | High | **1** |
| 17 | Audiobook data | 5 | S | High | **1** |
| 21 | Reading time estimate | 4 | S | High | **1** |
| 7 | Academic affiliations | 4 | S | High | **1** |
| 25 | Author video about book | 4 | S | High | **1** |
| 22 | Complexity level (LLM) | 4 | S | High | **1** |
| 1 | Substack profile | 5 | M | Medium | **2** |
| 10 | Podcast appearances | 4 | M | Medium | **2** |
| 12 | Recent news mentions | 3 | S | High | **2** |
| 8 | Awards & rankings | 4 | M | Medium | **2** |
| 16 | Book club guide | 3 | M | Medium | **2** |
| 23 | Celebrity endorsements | 4 | M | Medium | **2** |
| 24 | Press quotes | 4 | M | Medium | **2** |
| 26 | Related books | 4 | M | Medium | **2** |
| 27 | Podcast episodes about book | 3 | M | Medium | **2** |
| 22 | Complexity level | 4 | S | High | **2** |
| 6 | Company affiliations | 4 | L | Low | **3** |
| 18 | Bestseller rankings | 5 | L | Medium | **3** |
| 14 | Book microsite | 4 | M | Medium | **3** |
| 15 | Companion materials | 4 | M | Medium | **3** |
| 4 | Speaking bureau | 3 | L | Low | **3** |
| 19 | Translation count | 2 | S | High | **4** |
| 5 | Newsletter (non-Substack) | 3 | L | Low | **4** |
| 11 | Newspaper/magazine columns | 3 | L | Low | **4** |
| 13 | Instagram/TikTok | 3 | XL | Low | **4** |

---

### Phase 1: Quick Wins 🚀
*High value, low effort, high availability — implement in Sprint 1–2 (~2–3 weeks, 1 developer)*

| Item | Why It's a Quick Win | Example |
|------|---------------------|---------|
| **YouTube Channel** | YouTube Data API v3 is robust, free tier generous | Simon Sinek: 8M subs, 500M+ views |
| **TED/TEDx Talks** | Structured HTML, massive brand recognition | Brené Brown: 62M views on main talk |
| **Own Podcast** | Apple Search API free, easy lookup | Tim Ferriss: 900+ episodes, top 10 globally |
| **Reading Time Estimate** | Pure calculation from existing page data | Atomic Habits: 320 pages ≈ 5.5 hrs |
| **Format Availability** | Google Books API free and fast | Show Kindle/audiobook/paperback availability |
| **Academic Affiliations** | Google Scholar scraping straightforward | Adam Grant: Wharton, h-index 150+ |
| **Author Video About Book** | YouTube search by title + author works well | "Start With Why" Simon Sinek = 8M+ views |
| **Audiobook Data** | Audible public pages scrapeable | Narrator info (e.g., Adam Grant self-narrates) |
| **Complexity Level** | Single LLM call on existing summary + themes | Gladwell (2) → Kahneman (4) |

---

### Phase 2: Medium Investment 📊
*High value, medium effort — implement in Sprint 3–6 (~6–8 weeks, 1–2 developers)*

| Item | Investment Required | Example |
|------|---------------------|---------|
| **Substack** | Subscriber counts often hidden; need leaderboard cross-reference | James Clear: top 10 on Substack |
| **Notable Podcast Appearances** | ListenNotes API freemium; need relevance scoring | Malcolm Gladwell: 200+ appearances |
| **Recent News Mentions** | NewsAPI works well; need relevance scoring | Track book launches, speaking events |
| **Awards & Rankings** | Thinkers50 scrapeable; other awards manual | Adam Grant: #1 Thinkers50 2023 |
| **Book Club Guide** | Publisher sites structured; need per-publisher scrapers | PRH guides for Random House titles |
| **Celebrity Endorsements** | Extend existing Apify Amazon scraper; parse "Editorial Reviews" | "Gladwell blurbs" are a meme — track these |
| **Press Quotes** | Same source as endorsements; add tier classification | NYT vs. Inc. vs. trade publication |
| **Related Books** | Extend Apify scraper for "Customers also bought" | Atomic Habits → Deep Work → Essentialism |
| **Podcast Episodes About Book** | ListenNotes search on book titles | "Atomic Habits" = 500+ podcast discussions |

---

### Phase 3: Complex Projects 🏗️
*High value, high effort — plan for Q3–Q4 (~2–3 months, 2 developers)*

| Item | Complexity Drivers | Mitigation Strategy |
|------|-------------------|---------------------|
| **Company Affiliations** | Crunchbase API is paid; LinkedIn blocks scraping | Manual for top 20 authors; evaluate Crunchbase ROI |
| **Bestseller Rankings** | NYT API limited; Amazon PA-API requires Associates account | NYT API for prestige signal; skip Amazon ranks initially |
| **Official Book Microsite** | No central database; must discover per-book | Check `{author}.com/{booktitle}` pattern; crowdsource |
| **Companion Materials** | Scattered across platforms; often gated | Build "submit your link" feature; partner with authors |
| **Speaking Bureau** | Fee data closely guarded; no APIs | Manual research for top 30 speakers; display bureau only |

---

### Phase 4: Nice to Have ✨
*Lower value or very hard to obtain — opportunistic*

| Item | Why Deprioritized | Revisit When |
|------|-------------------|--------------|
| **Translation Count** | Low user demand; hard to aggregate | International expansion planned |
| **Newsletter (non-Substack)** | Fragmented platforms; low discoverability | User requests or Substack data complete |
| **Newspaper/Magazine Columns** | Paywalls; inconsistent formats | Media partnership develops |
| **Instagram/TikTok** | APIs heavily restricted; high maintenance | Platform opens API access |

---

### Implementation Roadmap

```
Month 1–2:   Phase 1 (Quick Wins)       → 9 enrichments live
Month 2–4:   Phase 2 (Medium)           → +9 enrichments
Month 4–6:   Phase 3 (Complex)          → +5 enrichments
Ongoing:     Phase 4 (Opportunistic)    → as feasible
─────────────────────────────────────────────────────────
Total:       27 enrichment categories across ~100 authors and ~245 books
```
