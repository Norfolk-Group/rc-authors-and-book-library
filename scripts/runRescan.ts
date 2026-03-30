/**
 * Standalone Drive rescan script.
 * Runs outside the tRPC auth layer — safe to execute directly in the sandbox.
 * Usage: npx tsx scripts/runRescan.ts
 *
 * This script re-uses the exact same scan + file-write logic as
 * trpc.library.regenerate, but without the admin auth check.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { validateAuthorName } from "../shared/authorNameValidator";

// Load env (DATABASE_URL etc.)
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LIBRARY_DATA_PATH = path.join(PROJECT_ROOT, "client", "src", "lib", "libraryData.ts");
const AUDIO_DATA_PATH   = path.join(PROJECT_ROOT, "client", "src", "lib", "audioData.ts");

// ── Drive env ──────────────────────────────────────────────────────────────
const AUTHORS_ROOT    = process.env.DRIVE_AUTHORS_FOLDER_ID    ?? "";
const BOOKS_AUDIO_ROOT = process.env.DRIVE_BOOKS_AUDIO_FOLDER_ID ?? "";

const AUDIO_FOLDER_NAMES = new Set([
  "audio mp3", "audible", "mp3", "audiable", "audio mb4", "audio",
  "audible mp3", "audio m4b",
]);
const CONTENT_TYPE_NORMALIZE: Record<string, string> = {
  "book pdf": "PDF", "pdf extra": "PDF", "bonus pdf": "PDF",
  "transcript doc": "Transcript", "transcript pdf": "Transcript",
  "book doc": "Transcript", "doc": "DOC",
  "book doc por br": "Supplemental", "supplemental": "Supplemental",
  "images": "Images", "image": "Images",
  "video": "Video", "binder": "Binder", "summary": "Summary",
  "papers": "Papers", "paper": "Papers", "research papers": "Papers",
  "articles": "Articles", "article": "Articles",
  "links": "Links", "link": "Links", "web links": "Links",
  "other": "Other", "pdf": "PDF", "transcript": "Transcript",
  "substack": "Substack", "substack posts": "Substack", "substack articles": "Substack",
  "medium": "Medium", "medium posts": "Medium", "medium articles": "Medium",
  "blog": "Blog", "blog posts": "Blog",
  "newsletter": "Newsletter", "newsletters": "Newsletter",
};
const CATEGORY_COLORS: Record<string, string> = {
  "Business & Entrepreneurship": "#b45309",
  "Behavioral Science & Psychology": "#7c3aed",
  "Sales & Negotiation": "#0369a1",
  "Leadership & Management": "#065f46",
  "Self-Help & Productivity": "#b91c1c",
  "Communication & Storytelling": "#c2410c",
  "Technology & Futurism": "#1d4ed8",
  "Strategy & Economics": "#374151",
  "History & Biography": "#92400e",
};
const CATEGORY_BG: Record<string, string> = {
  "Business & Entrepreneurship": "#fef9ec",
  "Behavioral Science & Psychology": "#f5f3ff",
  "Sales & Negotiation": "#eff8ff",
  "Leadership & Management": "#f0fdf4",
  "Self-Help & Productivity": "#fff1f2",
  "Communication & Storytelling": "#fff7ed",
  "Technology & Futurism": "#eff6ff",
  "Strategy & Economics": "#f8fafc",
  "History & Biography": "#fdf8f0",
};
const CATEGORY_ICONS: Record<string, string> = {
  "Business & Entrepreneurship": "briefcase",
  "Behavioral Science & Psychology": "brain",
  "Sales & Negotiation": "handshake",
  "Leadership & Management": "users",
  "Self-Help & Productivity": "zap",
  "Communication & Storytelling": "message-circle",
  "Technology & Futurism": "cpu",
  "Strategy & Economics": "trending-up",
  "History & Biography": "book-open",
};

// ── Drive helpers ──────────────────────────────────────────────────────────
interface DriveFile { id: string; name: string; mimeType: string; }

function gwsList(parentId: string, retries = 3): DriveFile[] {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const params = JSON.stringify({
        q: `"${parentId}" in parents and trashed = false`,
        fields: "files(id,name,mimeType)",
        pageSize: 200,
      });
      const out = execSync(`gws drive files list --params '${params}'`, {
        encoding: "utf8", timeout: 30_000,
      });
      const data = JSON.parse(out);
      if (data.error) { if (attempt < retries - 1) continue; return []; }
      return data.files ?? [];
    } catch { if (attempt < retries - 1) continue; return []; }
  }
  return [];
}
function isFolder(item: DriveFile) { return item.mimeType.includes("folder"); }
function normalizeContentType(rawName: string): string {
  return CONTENT_TYPE_NORMALIZE[rawName.toLowerCase().trim()] ?? rawName;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface BookEntry  { name: string; id: string; contentTypes: Record<string, number>; }
interface AuthorEntry { name: string; id: string; category: string; books: BookEntry[]; }
interface BookRecord  { name: string; id: string; category: string; contentTypes: Record<string, number>; }
interface AudioFormat { folderId: string; fileCount: number; }
interface AudioBook   { id: string; title: string; bookAuthors: string; formats: Record<string, AudioFormat>; }

// ── Scan Authors ───────────────────────────────────────────────────────────
function scanAuthors(): { authors: AuthorEntry[]; books: BookRecord[] } {
  const authors: AuthorEntry[] = [];
  const books: BookRecord[] = [];
  const skipped: string[] = [];

  if (!AUTHORS_ROOT) {
    console.warn("[rescan] DRIVE_AUTHORS_FOLDER_ID not set — skipping author scan");
    return { authors, books };
  }

  const categoryFolders = gwsList(AUTHORS_ROOT).filter(isFolder);
  console.log(`[rescan] Found ${categoryFolders.length} category folders`);

  for (const catFolder of categoryFolders) {
    const category = catFolder.name;
    const authorFolders = gwsList(catFolder.id).filter(isFolder);

    for (const authorFolder of authorFolders) {
      // ── GUARDRAIL ──────────────────────────────────────────────────────
      const nameValidation = validateAuthorName(authorFolder.name);
      if (!nameValidation.valid) {
        console.warn(`[rescan] SKIPPED non-person folder "${authorFolder.name}": ${nameValidation.reason}`);
        skipped.push(`${authorFolder.name} (${nameValidation.reason})`);
        continue;
      }
      // ──────────────────────────────────────────────────────────────────

      const bookFolders = gwsList(authorFolder.id).filter(isFolder);
      const authorBooks: BookEntry[] = [];

      for (const bookFolder of bookFolders) {
        const contentFolders = gwsList(bookFolder.id).filter(isFolder);
        const contentTypes: Record<string, number> = {};
        for (const cf of contentFolders) {
          const ct = normalizeContentType(cf.name);
          const files = gwsList(cf.id);
          contentTypes[ct] = (contentTypes[ct] ?? 0) + files.filter(f => !isFolder(f)).length;
        }
        authorBooks.push({ name: bookFolder.name, id: bookFolder.id, contentTypes });
        books.push({ name: bookFolder.name, id: bookFolder.id, category, contentTypes });
      }

      authors.push({ name: authorFolder.name, id: authorFolder.id, category, books: authorBooks });
    }
  }

  console.log(`[rescan] Authors: ${authors.length}, Books: ${books.length}, Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    console.log("[rescan] Skipped folders:");
    skipped.forEach(s => console.log(`  - ${s}`));
  }
  return { authors, books };
}

// ── Scan Audio ─────────────────────────────────────────────────────────────
function countFilesInFolder(folderId: string): number {
  const items = gwsList(folderId);
  let count = 0;
  for (const item of items) {
    if (isFolder(item)) count += countFilesInFolder(item.id);
    else count += 1;
  }
  return count;
}

function scanAudio(): AudioBook[] {
  const audioBooks: AudioBook[] = [];
  if (!BOOKS_AUDIO_ROOT) {
    console.warn("[rescan] DRIVE_BOOKS_AUDIO_FOLDER_ID not set — skipping audio scan");
    return audioBooks;
  }
  const authorFolders = gwsList(BOOKS_AUDIO_ROOT).filter(isFolder);
  for (const authorFolder of authorFolders) {
    const bookFolders = gwsList(authorFolder.id).filter(isFolder);
    for (const bookFolder of bookFolders) {
      const subFolders = gwsList(bookFolder.id).filter(isFolder);
      // Derive bookAuthors from the author folder name (strip Drive suffixes)
      const bookAuthors = authorFolder.name.includes(" - ")
        ? authorFolder.name.slice(0, authorFolder.name.indexOf(" - ")).trim()
        : authorFolder.name;
      const formats: Record<string, { folderId: string; fileCount: number }> = {};
      for (const fmtFolder of subFolders) {
        const fmtName = normalizeContentType(fmtFolder.name);
        if (!AUDIO_FOLDER_NAMES.has(fmtFolder.name.toLowerCase())) continue;
        const fileCount = countFilesInFolder(fmtFolder.id);
        if (fileCount > 0) {
          formats[fmtName] = { folderId: fmtFolder.id, fileCount };
        }
      }
      if (Object.keys(formats).length > 0) {
        audioBooks.push({
          id: bookFolder.id,
          title: bookFolder.name,
          bookAuthors,
          formats,
        });
      }
    }
  }
  audioBooks.sort((a, b) => a.title.localeCompare(b.title));
  return audioBooks;
}

// ── Code generators ────────────────────────────────────────────────────────
function generateLibraryTs(authors: AuthorEntry[], books: BookRecord[]): string {
  return `// NCG Knowledge Library - auto-generated from Google Drive scan
// Generated: ${new Date().toISOString()}
// DO NOT EDIT MANUALLY — run scripts/runRescan.ts to regenerate

import type { AuthorEntry, BookRecord } from "./libraryConstants";
export type { AuthorEntry, BookRecord };
export {
  CATEGORIES, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS,
  CONTENT_TYPE_ICONS, CONTENT_TYPE_COLORS,
} from "./libraryConstants";

export const AUTHORS: AuthorEntry[] = ${JSON.stringify(authors, null, 2)};

export const BOOKS: BookRecord[] = ${JSON.stringify(books, null, 2)};
`;
}

function generateAudioTs(audioBooks: AudioBook[]): string {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const tsAudio = (a: AudioBook) => {
    const fmtsTs = Object.entries(a.formats)
      .map(([k, v]) => `"${k}": {"folderId": "${v.folderId}", "fileCount": ${v.fileCount}}`)
      .join(", ");
    return `  {\n    id: ${JSON.stringify(a.id)},\n    title: ${JSON.stringify(a.title)},\n    bookAuthors: ${JSON.stringify(a.bookAuthors)},\n    formats: {${fmtsTs}},\n  }`;
  };
  return `// NCG Library - Books Audio Data
// Source: Google Drive Books Audio folder
// Last updated: ${now} UTC
export interface AudioFormat {
  folderId: string;
  fileCount: number;
}
export interface AudioBook {
  id: string;
  title: string;
  bookAuthors: string;
  formats: Record<string, AudioFormat>;
}
export const AUDIO_BOOKS: AudioBook[] = [
${audioBooks.map(tsAudio).join(",\n")}
];
`;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== NCG Library Drive Rescan ===");
  console.log(`Authors folder: ${AUTHORS_ROOT || "(not set)"}`);
  console.log(`Audio folder:   ${BOOKS_AUDIO_ROOT || "(not set)"}`);
  console.log("");

  const startTime = Date.now();

  const { authors, books } = scanAuthors();
  const audioBooks = scanAudio();

  const libraryTs = generateLibraryTs(authors, books);
  const audioTs   = generateAudioTs(audioBooks);

  fs.writeFileSync(LIBRARY_DATA_PATH, libraryTs, "utf8");
  fs.writeFileSync(AUDIO_DATA_PATH,   audioTs,   "utf8");

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log("");
  console.log("=== Rescan Complete ===");
  console.log(`Authors:     ${authors.length}`);
  console.log(`Books:       ${books.length}`);
  console.log(`Audio books: ${audioBooks.length}`);
  console.log(`Elapsed:     ${elapsed}s`);
  console.log(`Written:     ${LIBRARY_DATA_PATH}`);
  console.log(`             ${AUDIO_DATA_PATH}`);
}

main().catch(err => {
  console.error("[rescan] Fatal error:", err);
  process.exit(1);
});
