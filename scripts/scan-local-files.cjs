#!/usr/bin/env node
/**
 * scan-local-files.cjs  —  DRY RUN, READ ONLY
 *
 * Scans your local D:\Authors_and_Books tree and reports what's there and how it
 * maps to the library, WITHOUT uploading or writing anything. Use this to see
 * the real shape of the upload job before we touch Cloudflare R2 or the DB.
 *
 * What it does:
 *   1. Walks the folder recursively
 *   2. Keeps only the file types we care about: PDF, DOC/DOCX, images
 *      (skips audio, video, EPUB)
 *   3. De-duplicates by SHA-256 content hash (catches the same file living in
 *      both an "Authors\..." folder and a "Books\..." folder)
 *   4. Reads the book list from the DB (READ ONLY) and matches files to books
 *   5. Reports: which of the books currently MISSING a PDF have a candidate
 *      file on disk, which don't, and which files match nothing
 *
 * It NEVER writes, uploads, or deletes. Safe to run any time.
 *
 * ── How to run (Windows PowerShell) ──────────────────────────────────────────
 *   npm install mysql2            (once, if you haven't)
 *   $env:DATABASE_URL = 'mysql://...'      (single quotes; from Railway)
 *   node scripts/scan-local-files.cjs
 *
 *   # custom folder:
 *   node scripts/scan-local-files.cjs "D:\some\other\folder"
 *   # save the full report:
 *   node scripts/scan-local-files.cjs > scan-report.txt
 *
 * DATABASE_URL is read from the environment only — never printed, never committed.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const DEFAULT_ROOT = "D:\\Authors_and_Books";

const DOC_EXTS = new Set([".pdf", ".doc", ".docx"]);
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp"]);
const SKIP_EXTS = new Set([
  ".mp3", ".m4a", ".m4b", ".wav", ".aac", ".flac", ".ogg", // audio
  ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm",          // video
  ".epub",                                                   // ebook (excluded)
]);

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(summary|analysis|key takeaways|unabridged|audiobook|ebook|epub|pdf|read|free|z-lib\.org|zlib|libgen|annas?-?archive)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s) {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 2));
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`  (skipped unreadable dir: ${dir} — ${e.message})`);
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
}

function hashFile(file) {
  const hash = crypto.createHash("sha256");
  const buf = fs.readFileSync(file);
  hash.update(buf);
  return hash.digest("hex");
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function loadBooks() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "\nERROR: DATABASE_URL is not set. Matching to books will be skipped.\n" +
        'Set it in PowerShell:  $env:DATABASE_URL = "mysql://..."  then re-run.\n'
    );
    return null;
  }
  let cfg;
  try {
    const u = new URL(url);
    cfg = {
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ""),
      ssl: { minVersion: "TLSv1.2" },
    };
  } catch {
    console.error("ERROR: DATABASE_URL is not a valid connection string.");
    return null;
  }

  const conn = await mysql.createConnection(cfg);
  try {
    const [books] = await conn.query(
      "SELECT id, bookTitle, authorName FROM book_profiles ORDER BY authorName, bookTitle"
    );
    const [bookItems] = await conn.query(`
      SELECT ci.title, SUM(CASE WHEN cf.fileType = 'pdf' THEN 1 ELSE 0 END) AS pdfCount
      FROM content_items ci
      LEFT JOIN content_files cf ON cf.contentItemId = ci.id
      WHERE ci.contentType = 'book'
      GROUP BY ci.id, ci.title
    `);
    const hasPdf = new Map();
    for (const it of bookItems) {
      const k = normalize(it.title);
      hasPdf.set(k, (hasPdf.get(k) || false) || Number(it.pdfCount) > 0);
    }
    return books.map((b) => ({
      id: b.id,
      title: b.bookTitle,
      author: b.authorName,
      norm: normalize(b.bookTitle),
      toks: tokens(b.bookTitle),
      hasPdf: Boolean(hasPdf.get(normalize(b.bookTitle))),
    }));
  } finally {
    await conn.end();
  }
}

function matchFileToBook(fileName, books) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const fNorm = normalize(base);
  const fToks = tokens(base);
  let best = null;
  let bestScore = 0;
  for (const b of books) {
    let score = 0;
    if (b.norm && (fNorm.includes(b.norm) || b.norm.includes(fNorm))) {
      score = 0.95;
    } else {
      score = jaccard(fToks, b.toks);
    }
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return bestScore >= 0.6 ? { book: best, score: bestScore } : null;
}

async function main() {
  const root = process.argv[2] || process.env.SCAN_DIR || DEFAULT_ROOT;
  console.log(`\n===== LOCAL FILE SCAN (read-only) =====`);
  console.log(`Root: ${root}\n`);

  if (!fs.existsSync(root)) {
    console.error(`ERROR: folder not found: ${root}`);
    process.exit(1);
  }

  const all = [];
  walk(root, all);

  const docs = [];
  const images = [];
  let skipped = 0;
  for (const f of all) {
    const ext = path.extname(f).toLowerCase();
    if (DOC_EXTS.has(ext)) docs.push(f);
    else if (IMG_EXTS.has(ext)) images.push(f);
    else if (SKIP_EXTS.has(ext)) skipped++;
  }

  // De-dup docs by content hash
  const byHash = new Map();
  let docBytes = 0;
  for (const f of docs) {
    let size = 0;
    let h;
    try {
      size = fs.statSync(f).size;
      h = hashFile(f);
    } catch (e) {
      // Skip locked/unreadable files instead of aborting the whole read-only audit.
      console.warn(`  (skipped unreadable file: ${f} — ${e.message})`);
      continue;
    }
    docBytes += size;
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(f);
  }
  const uniqueDocs = [...byHash.values()].map((g) => g[0]);
  const dupCount = docs.length - byHash.size;
  const dupClusters = [...byHash.values()].filter((g) => g.length > 1);

  console.log(`Files seen ............... ${all.length}`);
  console.log(`  Docs (pdf/doc/docx) .... ${docs.length}  (${fmtBytes(docBytes)})`);
  console.log(`  Images ................. ${images.length}`);
  console.log(`  Skipped (audio/video/epub) ${skipped}`);
  console.log(`Unique docs (by hash) .... ${byHash.size}`);
  console.log(`Duplicate doc files ...... ${dupCount} across ${dupClusters.length} clusters`);

  const books = await loadBooks();
  if (!books) {
    console.log(`\n(DB not available — listing unique docs only)\n`);
    uniqueDocs.slice(0, 50).forEach((f) => console.log(`  • ${path.basename(f)}`));
    if (uniqueDocs.length > 50) console.log(`  ...and ${uniqueDocs.length - 50} more`);
    return;
  }

  const missingBooks = books.filter((b) => !b.hasPdf);
  const matchedMissing = new Map(); // bookId -> {book, file, score}
  const matchedAny = new Set();
  const unmatched = [];

  for (const f of uniqueDocs) {
    if (path.extname(f).toLowerCase() === ".pdf" || DOC_EXTS.has(path.extname(f).toLowerCase())) {
      const m = matchFileToBook(path.basename(f), books);
      if (m) {
        matchedAny.add(f);
        if (!m.book.hasPdf) {
          const prev = matchedMissing.get(m.book.id);
          if (!prev || m.score > prev.score) {
            matchedMissing.set(m.book.id, { book: m.book, file: f, score: m.score });
          }
        }
      } else {
        unmatched.push(f);
      }
    }
  }

  console.log(`\n----- BOOK COVERAGE FROM D:\\ -----`);
  console.log(`Books in library ............. ${books.length}`);
  console.log(`Books currently MISSING a PDF  ${missingBooks.length}`);
  console.log(`  ...that HAVE a candidate file on disk: ${matchedMissing.size}`);
  console.log(`  ...with NO candidate on disk:          ${missingBooks.length - matchedMissing.size}`);

  if (matchedMissing.size) {
    console.log(`\n----- MISSING BOOKS WE CAN FILL FROM D:\\ -----`);
    for (const { book, file, score } of [...matchedMissing.values()].sort((a, b) =>
      a.book.title.localeCompare(b.book.title)
    )) {
      console.log(`  ✓ ${book.title} — ${book.author || "?"}`);
      console.log(`      → ${path.basename(file)}  (match ${(score * 100).toFixed(0)}%)`);
    }
  }

  const stillMissing = missingBooks.filter((b) => !matchedMissing.has(b.id));
  if (stillMissing.length) {
    console.log(`\n----- MISSING BOOKS WITH NO FILE IN D:\\ -----`);
    stillMissing
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((b) => console.log(`  ✗ ${b.title} — ${b.author || "?"}`));
  }

  console.log(`\n----- UNIQUE DOCS THAT MATCHED NO BOOK (${unmatched.length}) -----`);
  unmatched.slice(0, 40).forEach((f) => console.log(`  ? ${path.basename(f)}`));
  if (unmatched.length > 40) console.log(`  ...and ${unmatched.length - 40} more`);

  console.log(`\n===== END OF DRY RUN — nothing was uploaded or changed =====\n`);
}

main().catch((err) => {
  console.error("Scan failed:", err.message);
  process.exit(1);
});
