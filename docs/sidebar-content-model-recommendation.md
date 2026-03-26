# NCG Library — Sidebar Navigation & Content Model Recommendation

**Version:** 1.0 · **Date:** March 2026 · **Author:** Manus AI

---

## 1. The Core Design Principle

The library has two fundamentally different kinds of things: **people/entities** (authors) and **output** (everything they create or are associated with). The sidebar should reflect this distinction cleanly. Authors are always the anchor — every piece of content belongs to one or more authors. The navigation tabs are simply lenses through which you browse that content by format or medium.

---

## 2. Recommended Sidebar Navigation Structure

The current sidebar has four tabs: Authors, Books, Books Audio, and Favorites. The recommendation is to expand this to **seven tabs** organized into two logical groups.

### Group 1 — People

| Tab | Icon | What It Shows |
|---|---|---|
| **Authors** | Person silhouette | All people and entities in the library — the primary anchor for everything else |

### Group 2 — Content by Medium

| Tab | Icon | What It Shows |
|---|---|---|
| **Books** | Open book | Physical books, digital books (PDF/EPUB), and audiobooks — all formats of the same work unified under one tab |
| **Written** | Document with lines | Articles, newspaper columns, academic papers, research reports, essays, blog posts, newsletters, Substack publications — any long-form written output not published as a book |
| **Audio & Video** | Play button | Podcasts, podcast episodes, YouTube channels, YouTube videos, TED talks, speeches, keynotes, radio content, interviews |
| **Courses & Talks** | Graduation cap | Masterclass courses, online courses (Coursera, Udemy, Teachable), commencement addresses, conference keynotes |
| **Film & TV** | Film strip | Feature films, documentaries, TV series, TV episodes, streaming specials |
| **Favorites** | Heart | User's personally saved items across all content types |

This gives you **six content tabs** plus the **Authors** anchor, for seven total. The sidebar remains scannable because the groupings are intuitive — if you are looking for something to read, you go to Books or Written; if you want to watch or listen, you go to Audio & Video or Film & TV.

### Why Not More Tabs?

Photography, social posts, and tools are real content types but they are niche enough that they work better as **filter options within the Written or Audio & Video tabs** rather than as top-level navigation entries. A tab with three items creates a poor browsing experience. These types will be supported in the data model and accessible via search and author profiles, but they will not get their own sidebar tab unless the collection grows to justify it.

---

## 3. Books Tab — Unified Format Model

The current app separates Books and Books Audio into two tabs. The recommendation is to **unify them** under a single Books tab, because a book is a work — not a file format. The format is an attribute of your copy, not of the work itself.

### The Possession & Format Model

Every book entry will carry two independent fields:

**`format`** — What copies you own or have access to:

| Value | Meaning |
|---|---|
| `physical` | You own a physical print copy |
| `digital` | You have a digital file (PDF, EPUB, MOBI) |
| `audio` | You have an audiobook (MP3, M4B, Audible) |
| `physical+digital` | Both print and digital |
| `physical+audio` | Both print and audio |
| `digital+audio` | Both digital and audio |
| `all` | All three formats |
| `none` | You do not own any copy — tracking for reference only |

**`possessionStatus`** — Your relationship to the work:

| Value | Meaning |
|---|---|
| `owned` | You own at least one copy (any format) |
| `wishlist` | You want to acquire it |
| `reference` | You are tracking it for research/context but do not intend to acquire |
| `borrowed` | You have a borrowed or library copy |
| `gifted` | You received it as a gift |

These two fields are independent. You can have `format: none` and `possessionStatus: reference` — meaning you know the book exists, you want its metadata, author profile, cover, summary, themes, and ratings fully enriched, but you do not own a copy. This is exactly the use case you described.

### How the Books Tab Will Work

Within the Books tab, users will be able to filter by format (show only audiobooks, show only digital, show only physical) and by possession status (show only owned, show only wishlist). The default view shows all books regardless of format or possession status. A small format badge on each book card will indicate what copies are available — a speaker icon for audio, a document icon for digital, a book icon for physical — so the user can see at a glance what they have without opening the card.

---

## 4. Written Tab — Papers, Articles, and Long-Form Content

The Written tab consolidates everything that is primarily text-based but is not a book. This is important because authors like Yuval Noah Harari, Malcolm Gladwell, and Michael Lewis have produced as much influential writing in magazines and newspapers as in books, and those works deserve equal standing in the library.

The Written tab will support the following content types, all of which can be linked to a PDF or external URL:

| Content Type | Examples |
|---|---|
| **Paper** | Academic papers, white papers, research reports, theses |
| **Article** | Newspaper columns, magazine features, online investigative pieces |
| **Essay** | Long-form essays, opinion pieces, manifestos |
| **Newsletter issue** | Individual issues of email newsletters (Beehiiv, ConvertKit, Mailchimp) |
| **Substack post** | Individual Substack articles (distinct from the publication itself) |
| **Blog post** | Individual posts from a personal blog |
| **Report** | Industry reports, government reports, think-tank publications |

Papers and articles will prominently display a PDF link badge when a PDF is available, consistent with the project's existing knowledge that these content types should be PDF-linkable.

---

## 5. Audio & Video Tab

This tab brings together all spoken and visual content. The unifying principle is that the primary consumption mode is listening or watching rather than reading.

| Content Type | Examples |
|---|---|
| **Podcast** | Full podcast shows (e.g., "How I Built This") |
| **Podcast episode** | Individual episodes with timestamps, show notes, transcript |
| **YouTube channel** | Author's full channel with subscriber/view stats |
| **YouTube video** | Individual videos — interviews, lectures, explainers |
| **TED talk** | TED and TEDx talks with view counts and event metadata |
| **Speech / Keynote** | Commencement addresses, conference keynotes, congressional testimony |
| **Interview** | Published interviews (audio or video) |
| **Radio** | Radio show appearances, radio documentaries |

---

## 6. Courses & Talks Tab

This tab is for structured educational content where the author is the instructor or primary speaker. It is distinct from Audio & Video because the user's intent when browsing here is learning rather than entertainment or information.

| Content Type | Examples |
|---|---|
| **Masterclass** | Masterclass.com courses |
| **Online course** | Courses on Coursera, Udemy, Teachable, Kajabi |
| **Workshop** | Multi-session live or recorded workshops |
| **Webinar** | Single-session educational webinars |
| **Keynote series** | A recurring speaking engagement (e.g., annual conference talk) |

---

## 7. Film & TV Tab

This tab is for long-form visual narrative content. It is the smallest tab by expected volume but important for authors like Ken Burns, Michael Moore, or Adam Curtis whose primary output is documentary film, or for business figures like Elon Musk or Jeff Bezos who appear as subjects in major productions.

| Content Type | Examples |
|---|---|
| **Film** | Feature films, documentaries |
| **TV series** | Documentary series, talk shows, reality series |
| **TV episode** | Individual episodes |
| **Streaming special** | Netflix/HBO/Amazon specials |

---

## 8. Content Ownership vs. Content Tracking

A critical design decision is that **every content type supports the same possession model as books**. You do not need to own or have downloaded a podcast episode to track it. You do not need a Netflix subscription to track a documentary. The library is a knowledge graph of what exists and what an author has created — possession is just one optional attribute.

This means the `format` and `possessionStatus` fields described in Section 3 apply universally:

| Scenario | format | possessionStatus |
|---|---|---|
| Book you own in print and digital | `physical+digital` | `owned` |
| Book you know exists but don't own | `none` | `reference` |
| Audiobook on your phone | `audio` | `owned` |
| Book you want to buy | `none` | `wishlist` |
| Podcast you follow | `audio` (streaming) | `owned` |
| TED talk you've watched | `video` | `reference` |
| Film on your watchlist | `none` | `wishlist` |
| Academic paper with PDF | `digital` | `owned` |

---

## 9. Implementation Order

Given the scope, the following sequence minimizes risk while delivering visible value at each step:

| Step | What Gets Built | User Impact |
|---|---|---|
| **1** | Add `format` and `possessionStatus` fields to `book_profiles`; add format badges to book cards; unify Books + Books Audio tabs | Immediate — you can now track physical-only books |
| **2** | Add Written tab (empty, with "Add content" CTA); add Paper and Article as content types | Visible new tab; can start adding articles |
| **3** | Add Audio & Video tab; migrate podcast/YouTube/TED data from author profile JSON fields into proper content item rows | Structured browsing of audio/video content |
| **4** | Add Courses & Talks and Film & TV tabs | Full navigation structure complete |
| **5** | CRUD forms for all content types | Full self-service content management |
| **6** | Enrichment pipelines for non-book types | Automated metadata for new content types |

---

## 10. Summary

The recommendation consolidates the current four-tab sidebar into a seven-tab structure that cleanly separates people (Authors) from content (Books, Written, Audio & Video, Courses & Talks, Film & TV, Favorites). Books become format-agnostic — physical, digital, audio, and reference-only books all live in one tab with format badges. Every content type supports a possession/format model so you can track works you know about without needing to own a copy. The Written tab gives first-class status to papers, articles, newsletters, and Substack content. The data model changes are additive and non-breaking — existing books and authors are unaffected.

---

*Ready for implementation upon approval.*
