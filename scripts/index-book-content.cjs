/**
 * index-book-content.cjs
 *
 * Parses the book/notes files for a named author group (uploaded earlier by
 * upload-to-r2.cjs), chunks them, embeds each chunk with Gemini, and indexes
 * them into Neon pgvector under per-author namespaces — the knowledge base for
 * the "book agents" and "author agents".
 *
 * Pure Node.js (CommonJS, no tsx) — same constraints as reindex_pg.cjs. It reads
 * files LOCALLY from the manifest's root (D:\Authors_and_Books), so it does NOT
 * need R2 credentials. It stores each file's R2 URL (from the manifest) as the
 * canonical reference in the vector metadata.
 *
 * ── What it does ──────────────────────────────────────────────────────────────
 *   1. Loads a group definition (scripts/groups/<group>.json) — a list of author
 *      folder names.
 *   2. Loads r2-upload-manifest.json and keeps files whose sourcePath is under
 *      `Authors\<name>\` for a name in the group.
 *   3. Resolves each folder name to an author_profiles row (id + canonical name).
 *   4. For each file: parses (PDF via unpdf, DOCX via mammoth), detects whether
 *      it's the book itself or owner notes, best-effort matches it to a book row,
 *      chunks the text, and (on --commit) embeds + upserts each chunk to Neon.
 *
 * Each chunk is stored in namespace `author_<id>` with:
 *   content_type = "book" | "owner_notes" | "doc"
 *   source       = "<group key>"        (e.g. "super-conversations")
 *   source_id    = "book-<id>" | "file-<sha12>"
 *   category     = "book-<id>" | null    (lets a book agent filter to one book)
 *   url          = R2 public URL
 *   chunk_index / chunk_total
 *
 * ── Required env ──────────────────────────────────────────────────────────────
 *   DATABASE_URL        MySQL/TiDB (author + book lookup)   — dry run + commit
 *   NEON_DATABASE_URL   Neon pgvector (writes)              — commit only
 *   GEMINI_API_KEY      embeddings                          — commit only
 *
 * ── Run (Windows PowerShell, from the repo root) ──────────────────────────────
 *   $env:DATABASE_URL      = 'mysql://...'      # from Railway
 *   $env:NEON_DATABASE_URL = 'postgres://...'   # from Railway
 *   $env:GEMINI_API_KEY    = '...'              # from Railway
 *
 *   # DRY RUN first — parses, matches, chunks, reports. Writes NOTHING, no API cost:
 *   node scripts/index-book-content.cjs --group super-conversations
 *
 *   # Validate the report, then actually embed + index:
 *   node scripts/index-book-content.cjs --group super-conversations --commit
 *
 *   # Options: --limit N (first N files, for a quick test) · --author "Adam Grant"
 *   #          --manifest path\to\manifest.json · --root D:\Authors_and_Books
 *
 * Safe to re-run: chunk IDs are deterministic, so ON CONFLICT updates in place.
 */

"use strict";
require("dotenv/config");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { Client } = require("pg");

// ── Args ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : def;
};
const COMMIT = args.includes("--commit");
// By default, keep only the single richest copy of each book (people often have
// the same book as Binder PDF + Complete PDF + Transcript DOCX). --no-dedupe
// indexes every copy.
const DEDUPE = !args.includes("--no-dedupe");
const GROUP = getArg("group", "super-conversations");
const MANIFEST_PATH = getArg("manifest", "r2-upload-manifest.json");
const ONLY_AUTHOR = getArg("author", null);
const LIMIT = getArg("limit", null) ? parseInt(getArg("limit"), 10) : null;

const MIN_TEXT_CHARS = 200; // below this we flag the file for an OCR pass
const DOC_EXTS = new Set([".pdf", ".docx"]);
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp"]);

// ── Gemini embedding (1536-dim) — mirrors reindex_pg.cjs ─────────────────────────
function httpsPost(hostname, p, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path: p, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try { resolve(JSON.parse(buf)); } catch { reject(new Error("JSON parse error: " + buf.slice(0, 200))); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("Request timeout")));
    req.write(data);
    req.end();
  });
}

async function embedText(text) {
  const result = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    { model: "models/gemini-embedding-001", content: { parts: [{ text: text.slice(0, 8192) }] }, outputDimensionality: 1536 }
  );
  if (result.error) throw new Error(JSON.stringify(result.error));
  const values = result.embedding && result.embedding.values;
  if (!values || values.length === 0) throw new Error("Empty embedding returned");
  return values;
}

// ── Chunker — ported from server/services/chunking.service.ts ───────────────────
const CHARS_PER_TOKEN = 4;
function approxTokens(t) { return Math.ceil(t.length / CHARS_PER_TOKEN); }
function findSplit(text, targetIndex) {
  if (targetIndex >= text.length) return text.length;
  const minSearch = Math.max(0, targetIndex - 400);
  const para = text.lastIndexOf("\n\n", targetIndex);
  if (para >= minSearch) return para + 2;
  const sentenceRe = /[.!?]\s/g;
  let bestSentence = -1, m;
  sentenceRe.lastIndex = minSearch;
  while ((m = sentenceRe.exec(text)) !== null) {
    if (m.index > targetIndex) break;
    bestSentence = m.index + m[0].length;
  }
  if (bestSentence >= minSearch) return bestSentence;
  const space = text.lastIndexOf(" ", targetIndex);
  if (space >= minSearch) return space + 1;
  return targetIndex;
}
function chunkText(text, opts = {}) {
  const cleaned = String(text).replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const targetTokens = opts.targetTokens || 800;
  const overlapTokens = opts.overlapTokens || 100;
  const minTokens = opts.minTokens || 80;
  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const minChars = minTokens * CHARS_PER_TOKEN;
  if (cleaned.length <= targetChars) return [{ text: cleaned, index: 0, approxTokens: approxTokens(cleaned) }];
  const chunks = [];
  let cursor = 0;
  while (cursor < cleaned.length) {
    const targetEnd = Math.min(cleaned.length, cursor + targetChars);
    const end = findSplit(cleaned, targetEnd);
    const slice = cleaned.slice(cursor, end).trim();
    if (slice) {
      if (slice.length < minChars && chunks.length > 0 && end >= cleaned.length) {
        const last = chunks[chunks.length - 1];
        last.text = `${last.text}\n\n${slice}`.trim();
        last.approxTokens = approxTokens(last.text);
        break;
      }
      chunks.push({ text: slice, index: chunks.length, approxTokens: approxTokens(slice) });
    }
    if (end >= cleaned.length) break;
    cursor = Math.max(cursor + 1, end - overlapChars);
  }
  return chunks;
}

// ── Parsing ──────────────────────────────────────────────────────────────────────
async function parsePdf(buf) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // verbosity: 0 (errors only) silences pdf.js's noisy per-glyph font warnings.
  const doc = await getDocumentProxy(new Uint8Array(buf), { verbosity: 0 });
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : (text || "");
}
async function parseDocx(buf) {
  const mammoth = require("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value || "";
}
async function parseFile(absPath, ext) {
  const buf = fs.readFileSync(absPath);
  if (ext === ".pdf") return parsePdf(buf);
  if (ext === ".docx") return parseDocx(buf);
  return "";
}

// ── Title matching ───────────────────────────────────────────────────────────────
function normalizeTitle(s) {
  return String(s)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\b(binder\d*|part\s*\d+|final|draft|copy|v\d+|chapter\s*\d+)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function tokenSet(s) { return new Set(normalizeTitle(s).split(" ").filter((w) => w.length > 2)); }
function jaccard(a, b) {
  const A = tokenSet(a), B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
}
// Category subfolders that are NOT book titles (so we never mistake one for a title).
const GENERIC_FOLDERS = new Set([
  "binder", "book pdf", "book", "complete book in pdf", "knowledge base",
  "transcript doc", "transcript pdf", "transcript", "pdf extra", "pdf", "doc",
  "docx", "audio", "video", "epub", "images", "cover", "covers",
]);
// Recover candidate book-title strings from a file's source paths. The folder
// layout usually encodes the title better than the (often cryptic) filename:
//   Authors\<author> - <desc>\<Title>\<category>\file  ->  <Title>
//   Books\<Title> by <author>\<category>\file          ->  <Title>
function bookTitleHints(sourcePaths) {
  const hints = [];
  for (const p of sourcePaths || []) {
    const s = segs(p);
    const top = (s[0] || "").toLowerCase();
    if (top === "authors" && s[2] && !GENERIC_FOLDERS.has(s[2].toLowerCase())) {
      hints.push(s[2]);
    } else if (top === "books" && s[1] && !/^xx\b/i.test(s[1])) {
      hints.push(s[1].split(/\s+by\s+/i)[0].trim());
    }
  }
  return hints;
}
// Match a file to a book row using the title hints first, then the filename.
function matchBook(filename, hints, books) {
  const candidates = [...(hints || []), filename];
  let best = null, score = 0;
  for (const b of books) {
    for (const c of candidates) {
      const s = jaccard(c, b.bookTitle);
      if (s > score) { score = s; best = b; }
    }
  }
  return score >= 0.4 ? { book: best, score } : null;
}
function detectSourceKind(filename, matchedBook) {
  const f = filename.toLowerCase();
  if (/\bnotes?\b/.test(f) || /ricardo\s+cidale/.test(f)) return "owner_notes";
  return matchedBook ? "book" : "doc";
}

// ── MySQL helpers ────────────────────────────────────────────────────────────────
function mysqlQuery(pool, sql, params) {
  return new Promise((resolve, reject) => pool.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
}
async function resolveAuthor(pool, folderName) {
  let rows = await mysqlQuery(pool, `SELECT id, authorName FROM author_profiles WHERE authorName = ? LIMIT 1`, [folderName]);
  if (rows.length) return rows[0];
  // Fall back to a loose match on the first and last tokens (handles "David N. Schwartz" etc.)
  const tokens = folderName.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const like = `${tokens[0]}%${tokens[tokens.length - 1]}`;
    rows = await mysqlQuery(pool, `SELECT id, authorName FROM author_profiles WHERE authorName LIKE ? LIMIT 2`, [like]);
    if (rows.length === 1) return rows[0];
  }
  return null;
}

// ── Manifest filtering ───────────────────────────────────────────────────────────
function segs(p) { return String(p).split(/[\\/]/).filter(Boolean); }

// Normalize a person name for tolerant comparison: lowercase, drop periods/
// underscores, strip other punctuation, collapse whitespace.
function normName(s) {
  return String(s).toLowerCase().replace(/[._]/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
// On-disk Authors\ folders are named "<Author Name> - <description>" (separator
// is a hyphen, en-dash, or em-dash with surrounding spaces). Recover just the
// author-name portion the user typed.
function authorNameFromFolder(folderSeg) {
  return String(folderSeg).split(/\s+[-–—]\s+/)[0].trim();
}
// Map a recovered folder author name to a group author. Matches on equality,
// prefix, or first+last name tokens ("Daniel Siegel" ~ "Daniel J. Siegel").
function matchGroupAuthor(folderAuthor, groupAuthors) {
  const fn = normName(folderAuthor);
  if (!fn) return null;
  for (const g of groupAuthors) {
    const gn = normName(g);
    if (fn === gn || fn.startsWith(gn + " ") || gn.startsWith(fn + " ")) return g;
  }
  const ft = fn.split(" ");
  for (const g of groupAuthors) {
    const gt = normName(g).split(" ");
    if (ft.length >= 2 && gt.length >= 2 && ft[0] === gt[0] && ft[ft.length - 1] === gt[gt.length - 1]) return g;
  }
  return null;
}
function authorOfSourcePath(p, groupAuthors) {
  const s = segs(p);
  if (s.length >= 2 && s[0].toLowerCase() === "authors") {
    return matchGroupAuthor(authorNameFromFolder(s[1]), groupAuthors);
  }
  return null;
}

// ── Neon upsert ──────────────────────────────────────────────────────────────────
async function upsertChunk(neon, row) {
  const vectorStr = `[${row.embedding.join(",")}]`;
  await neon.query(
    `INSERT INTO vector_embeddings
       (id, namespace, content_type, source_id, title, author_name, source, url, chunk_index, chunk_total, text, category, embedding, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::vector, NOW())
     ON CONFLICT (id) DO UPDATE SET
       namespace=EXCLUDED.namespace, content_type=EXCLUDED.content_type, source_id=EXCLUDED.source_id,
       title=EXCLUDED.title, author_name=EXCLUDED.author_name, source=EXCLUDED.source, url=EXCLUDED.url,
       chunk_index=EXCLUDED.chunk_index, chunk_total=EXCLUDED.chunk_total, text=EXCLUDED.text,
       category=EXCLUDED.category, embedding=EXCLUDED.embedding, updated_at=NOW()`,
    [row.id, row.namespace, row.content_type, row.source_id, row.title, row.author_name, row.source,
     row.url, row.chunk_index, row.chunk_total, row.text, row.category, vectorStr]
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n===== INDEX BOOK CONTENT — group "${GROUP}" ${COMMIT ? "(COMMIT)" : "(DRY RUN)"} =====\n`);

  // Env checks
  if (!process.env.DATABASE_URL) { console.error("ERROR: DATABASE_URL is required (author + book lookup)."); process.exit(1); }
  if (COMMIT && !process.env.NEON_DATABASE_URL) { console.error("ERROR: NEON_DATABASE_URL is required for --commit."); process.exit(1); }
  if (COMMIT && !process.env.GEMINI_API_KEY) { console.error("ERROR: GEMINI_API_KEY is required for --commit."); process.exit(1); }

  // Group def
  const groupFile = path.join(__dirname, "groups", `${GROUP}.json`);
  if (!fs.existsSync(groupFile)) { console.error(`ERROR: group file not found: ${groupFile}`); process.exit(1); }
  const groupDef = JSON.parse(fs.readFileSync(groupFile, "utf8"));
  let groupAuthors = groupDef.authors;
  if (ONLY_AUTHOR) groupAuthors = groupAuthors.filter((a) => a === ONLY_AUTHOR);
  console.log(`Group: ${groupDef.label} (${groupAuthors.length} author folder(s))`);

  // Manifest
  if (!fs.existsSync(MANIFEST_PATH)) { console.error(`ERROR: manifest not found: ${MANIFEST_PATH} (run upload-to-r2.cjs first)`); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const root = getArg("root", manifest.root);
  console.log(`Root: ${root}`);
  console.log(`Manifest: ${MANIFEST_PATH} (${manifest.files.length} unique files)\n`);

  // Bucket files by author folder
  const byAuthor = new Map(); // folderName -> [{entry, sourcePath, ext}]
  for (const entry of manifest.files) {
    const ext = (entry.ext || path.extname(entry.originalFilename || "")).toLowerCase();
    for (const sp of entry.sourcePaths || []) {
      const folder = authorOfSourcePath(sp, groupAuthors);
      if (folder) {
        if (!byAuthor.has(folder)) byAuthor.set(folder, []);
        byAuthor.get(folder).push({ entry, sourcePath: sp, ext });
        break;
      }
    }
  }

  // Connections
  const pool = require("mysql2").createPool(process.env.DATABASE_URL);
  const neon = COMMIT ? new Client({ connectionString: process.env.NEON_DATABASE_URL }) : null;
  if (neon) await neon.connect();

  const report = { authorsMatched: 0, authorsUnmatched: [], filesParsed: 0, filesEmpty: [], imagesSkipped: 0, ocrNeeded: [], duplicatesSkipped: 0, chunks: 0, vectors: 0, errors: [] };
  let processed = 0;

  for (const folderName of groupAuthors) {
    const files = byAuthor.get(folderName) || [];
    const author = await resolveAuthor(pool, folderName);
    if (!author) {
      report.authorsUnmatched.push(folderName);
      console.log(`\n■ ${folderName} — NO author_profiles match (${files.length} file(s) skipped; add an alias or create the author)`);
      continue;
    }
    report.authorsMatched++;
    const books = await mysqlQuery(pool, `SELECT id, bookTitle FROM book_profiles WHERE authorName = ?`, [author.authorName]);
    console.log(`\n■ ${folderName} → author#${author.id} "${author.authorName}"  (${files.length} file(s), ${books.length} book row(s))`);

    // Phase 1 — parse + chunk every candidate file for this author.
    const candidates = [];
    for (const f of files) {
      if (LIMIT !== null && processed >= LIMIT) break;
      processed++;
      const fname = path.basename(f.sourcePath);
      if (IMG_EXTS.has(f.ext)) { report.imagesSkipped++; console.log(`    · ${fname} — image, skipped`); continue; }
      if (!DOC_EXTS.has(f.ext)) { console.log(`    · ${fname} — unsupported (${f.ext}), skipped`); continue; }

      const abs = path.join(root, f.sourcePath);
      if (!fs.existsSync(abs)) { report.errors.push(`missing local file: ${abs}`); console.log(`    ✗ ${fname} — local file not found`); continue; }

      let text = "";
      try { text = await parseFile(abs, f.ext); }
      catch (e) { report.errors.push(`${fname}: ${e.message}`); console.log(`    ✗ ${fname} — parse error: ${e.message}`); continue; }

      if (text.trim().length < MIN_TEXT_CHARS) {
        report.ocrNeeded.push(`${author.authorName} / ${fname}`);
        console.log(`    ⚠ ${fname} — only ${text.trim().length} chars (likely scanned; flagged for OCR pass)`);
        continue;
      }
      report.filesParsed++;

      const matched = matchBook(fname, bookTitleHints(f.entry.sourcePaths), books);
      const kind = detectSourceKind(fname, matched && matched.book);
      const chunks = chunkText(text);
      const sha12 = (f.entry.sha256 || crypto.createHash("sha256").update(fname).digest("hex")).slice(0, 12);
      candidates.push({ fname, sha12, matched, kind, chunks, url: f.entry.url || null });
    }

    // Phase 2 — dedupe book copies: keep the single richest copy per book row;
    // keep every owner_notes and unmatched doc. (Disabled with --no-dedupe.)
    const skipDup = new Set();
    if (DEDUPE) {
      const bestByBook = new Map(); // bookId -> index of the richest "book" candidate
      candidates.forEach((c, i) => {
        if (c.kind !== "book" || !c.matched) return;
        const key = c.matched.book.id;
        const prev = bestByBook.get(key);
        if (prev === undefined || candidates[prev].chunks.length < c.chunks.length) {
          if (prev !== undefined) skipDup.add(prev);
          bestByBook.set(key, i);
        } else {
          skipDup.add(i);
        }
      });
    }

    // Phase 3 — report and (on --commit) embed the kept candidates.
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const matchLabel = c.matched ? `book#${c.matched.book.id} "${c.matched.book.bookTitle}" (${c.matched.score.toFixed(2)})` : "no book match";
      if (skipDup.has(i)) {
        report.duplicatesSkipped++;
        console.log(`    ⊘ ${c.fname} — duplicate of ${matchLabel}, ${c.chunks.length} chunks skipped`);
        continue;
      }
      report.chunks += c.chunks.length;
      console.log(`    ✓ ${c.fname} — ${c.kind}, ${c.chunks.length} chunks, ${matchLabel}`);

      if (!COMMIT) continue;

      for (const ch of c.chunks) {
        try {
          const embedding = await embedText(ch.text);
          await upsertChunk(neon, {
            id: `a${author.id}-${c.sha12}-c${ch.index}`,
            namespace: `author_${author.id}`,
            content_type: c.kind,
            source_id: c.matched ? `book-${c.matched.book.id}` : `file-${c.sha12}`,
            title: c.matched ? c.matched.book.bookTitle : c.fname,
            author_name: author.authorName,
            source: GROUP,
            url: c.url,
            chunk_index: ch.index,
            chunk_total: c.chunks.length,
            text: ch.text,
            category: c.matched ? `book-${c.matched.book.id}` : null,
            embedding,
          });
          report.vectors++;
        } catch (e) {
          report.errors.push(`${c.fname} chunk ${ch.index}: ${e.message}`);
        }
      }
    }
    if (LIMIT !== null && processed >= LIMIT) { console.log(`\n(reached --limit ${LIMIT})`); break; }
  }

  // Report
  console.log(`\n===== ${COMMIT ? "DONE" : "DRY RUN"} =====`);
  console.log(`Authors matched ......... ${report.authorsMatched}/${groupAuthors.length}`);
  if (report.authorsUnmatched.length) console.log(`Authors UNMATCHED ....... ${report.authorsUnmatched.join(", ")}`);
  console.log(`Files parsed ............ ${report.filesParsed}`);
  console.log(`Images skipped .......... ${report.imagesSkipped}`);
  if (DEDUPE) console.log(`Duplicate copies skipped  ${report.duplicatesSkipped}`);
  console.log(`Chunks (to index) ....... ${report.chunks}`);
  if (COMMIT) console.log(`Vectors written ......... ${report.vectors}`);
  if (report.ocrNeeded.length) {
    console.log(`\nFlagged for OCR (${report.ocrNeeded.length}):`);
    report.ocrNeeded.slice(0, 25).forEach((x) => console.log(`  - ${x}`));
    if (report.ocrNeeded.length > 25) console.log(`  ...and ${report.ocrNeeded.length - 25} more`);
  }
  if (report.errors.length) {
    console.log(`\nErrors (${report.errors.length}):`);
    report.errors.slice(0, 25).forEach((x) => console.log(`  - ${x}`));
  }
  if (!COMMIT) console.log(`\nThis was a DRY RUN — nothing written. Re-run with --commit to embed + index.\n`);

  if (neon) await neon.end();
  pool.end();
  // Fail loudly for automation: a real commit that recorded errors is a partial
  // index, not a success. Dry runs stay informational (exit 0).
  process.exit(COMMIT && report.errors.length ? 1 : 0);
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
