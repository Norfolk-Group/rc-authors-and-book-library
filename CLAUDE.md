# CLAUDE.md — NCG Knowledge Library

This file provides project context for AI coding assistants (Claude, Manus, etc.) working on this codebase.

---

## Project Overview

**Name:** NCG Knowledge Library (`authors-books-library`)
**Purpose:** A searchable, filterable reference site for the Norfolk Consulting Group's curated library of authors, books, and audiobooks — all backed by Google Drive.
**Stack:** React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + Vite (static frontend only)
**Live URL:** https://authlib-ehsrgokn.manus.space

---

## Architecture

This is a **static frontend-only** project. There is no backend, database, or API layer. All data is embedded directly in TypeScript modules generated from Google Drive scans.

```
authors-books-library/
├── client/
│   ├── index.html                  ← Entry HTML (Google Fonts: Playfair Display + DM Sans)
│   └── src/
│       ├── App.tsx                 ← Router (single route: Home)
│       ├── index.css               ← Global design tokens (warm paper palette, OKLCH colors)
│       ├── pages/
│       │   └── Home.tsx            ← Main page: sidebar-07 layout, search, tabs, card grid
│       ├── lib/
│       │   ├── libraryData.ts      ← All author + book data (generated from Drive scan)
│       │   └── audioData.ts        ← All audiobook data (generated from Drive scan)
│       ├── components/
│       │   ├── FileTypeIcons.tsx   ← File-type icon renderer using react-file-icon
│       │   └── ui/                 ← shadcn/ui primitives (sidebar, badge, input, etc.)
│       └── types/
│           └── react-file-icon.d.ts ← Type declarations for react-file-icon
├── .mcp.json                       ← shadcn MCP server config for Claude
├── CLAUDE.md                       ← This file
└── package.json
```

---

## Design System

**Philosophy:** Editorial Intelligence — a private library aesthetic inspired by *The Economist* and premium reference tools.

| Token | Value |
| :--- | :--- |
| Heading font | Playfair Display (serif) |
| Body font | DM Sans (sans-serif) |
| Background | Warm off-white `#faf9f6` (paper tone) |
| Foreground | Deep charcoal `oklch(0.235 0.015 65)` |
| Border radius | `0.65rem` |
| Card left border | 3px solid, category accent color |

**Category color system** (defined in `libraryData.ts`):

| Category | Accent Color | Background Tint |
| :--- | :--- | :--- |
| Business & Entrepreneurship | `#b45309` (amber) | `#fef9ec` |
| Behavioral Science & Psychology | `#7c3aed` (violet) | `#f5f3ff` |
| Sales & Negotiation | `#0369a1` (sky blue) | `#eff8ff` |
| Leadership & Management | `#065f46` (emerald) | `#f0fdf4` |
| Self-Help & Productivity | `#b91c1c` (rose) | `#fff1f2` |
| Communication & Storytelling | `#c2410c` (orange) | `#fff7ed` |
| Technology & Futurism | `#1d4ed8` (blue) | `#eff6ff` |
| Strategy & Economics | `#374151` (slate) | `#f8fafc` |
| History & Biography | `#92400e` (brown) | `#fdf8f0` |

**Card watermark:** Each card renders a large ghosted category icon (72×72px, 7% opacity, `strokeWidth={1}`) as a background illustration in the bottom-right corner.

---

## Data Layer

All data is **statically embedded** — no runtime API calls. To update the data, re-run the Python scan scripts against Google Drive and regenerate the TypeScript files.

### `libraryData.ts` exports

```ts
AUTHORS: AuthorEntry[]        // 97 authors across 9 categories
BOOKS: BookRecord[]           // 65 books across 9 categories
CATEGORIES: string[]          // 9 category names
CATEGORY_COLORS: Record<string, string>   // accent hex per category
CATEGORY_BG: Record<string, string>       // soft bg tint per category
CATEGORY_ICONS: Record<string, string>    // lucide icon name per category
CONTENT_TYPE_ICONS: Record<string, string>
CONTENT_TYPE_COLORS: Record<string, string>
```

### `AuthorEntry` shape

```ts
interface AuthorEntry {
  id: string;           // Google Drive folder ID
  name: string;         // "Author Name - Specialty description"
  category: string;     // One of the 9 categories
  books: {
    id: string;         // Google Drive subfolder ID
    name: string;       // Book title
    contentTypes: Record<string, number>; // e.g. { PDF: 2, Transcript: 1 }
  }[];
}
```

### `BookRecord` shape

```ts
interface BookRecord {
  id: string;           // Google Drive folder ID
  name: string;         // "Book Title - Author Name"
  category: string;
  contentTypes: Record<string, number>;
}
```

### `audioData.ts` exports

```ts
AUDIO_BOOKS: AudioBook[]
interface AudioBook {
  id: string;           // Books Audio folder ID for this title
  title: string;
  bookAuthors: string;
  formats: Record<string, { folderId: string; fileCount: number }>;
  // formats keys: "MP3", "M4B", "AAX"
}
```

---

## Google Drive Structure

The library mirrors this Drive hierarchy:

```
Norfolk Consulting Group/
├── Authors/
│   ├── Business & Entrepreneurship/
│   │   └── [Author Name - Specialty]/
│   │       └── [Book Title]/
│   │           ├── PDF/
│   │           ├── Binder/
│   │           ├── Transcript/
│   │           └── Audio/
│   ├── Behavioral Science & Psychology/
│   └── ... (9 categories total)
├── Books/
│   ├── Business & Entrepreneurship/
│   │   └── [Book Title - Author]/
│   │       ├── PDF/
│   │       ├── Binder/
│   │       └── Transcript/
│   └── ... (9 categories total)
└── Books Audio/
    └── [Book Title]/
        ├── MP3/
        ├── M4B/
        └── AAX/
```

**Content-type subfolder conventions:**

| Subfolder | Contents |
| :--- | :--- |
| `PDF` | Book PDF files |
| `Binder` | PDF binders / compiled reference documents |
| `Transcript` | Text transcripts of audio or video |
| `Audio` | Audio files within author/book folders |
| `DOC` / `DOCX` | Word documents |
| `Video` | MP4 / video files |
| `Zip` | Archive files |

---

## Development Commands

```bash
pnpm dev        # Start dev server (http://localhost:3000)
pnpm build      # Production build
pnpm check      # TypeScript type check (npx tsc --noEmit)
pnpm format     # Prettier formatting
```

---

## Key Conventions

1. **No backend changes** — `server/` directory is a placeholder only. Do not add routes or logic there.
2. **No local image assets** — all images must be uploaded to CDN via `manus-upload-file --webdev` and referenced by URL.
3. **Data updates** — to refresh library data, re-run the Python scan scripts in `/home/ubuntu/` against Google Drive using the `gws` CLI, then regenerate `libraryData.ts` and `audioData.ts`.
4. **Tailwind 4** — use OKLCH color format in `@theme` blocks, not HSL.
5. **shadcn/ui** — import components from `@/components/ui/*`. Check existing components before creating new ones.
6. **Co-authors** — books with multiple authors should have one card per author, each referencing the shared book.
7. **Card clicks** — clicking anywhere on a card opens the Google Drive folder in a new tab with `?view=grid` appended.
8. **Search** — live search highlights matches in author names, specialties, and book titles using the `highlight()` helper inside each card component.

---

## MCP Integration

The shadcn MCP server is configured in `.mcp.json`. Use it to install new shadcn components:

```bash
npx shadcn@latest add <component-name>
```

---

## Scan Scripts (in `/home/ubuntu/`)

| Script | Purpose |
| :--- | :--- |
| `rescan_library.py` | Full deep scan of Authors + Books folders → `library_scan_results.json` |
| `final_audio_move_v2.py` | Move audio files from Authors/Books into Books Audio |
| `delete_m4b_aax.py` | Remove all M4B and AAX files from Drive |
| `organize_authors.py` | Initial categorization of author folders |
| `organize_books.py` | Initial categorization of book folders |
| `reorganize_author_folders_v2.py` | Create book-named subfolders inside author folders |
| `reorganize_books_folders.py` | Create content-type subfolders inside book folders |

All scripts use the `gws` CLI for Google Drive API calls. Run with `python3.11 -u <script>.py`.

---

*Last updated: March 2026 — NCG Knowledge Library v1.0*
