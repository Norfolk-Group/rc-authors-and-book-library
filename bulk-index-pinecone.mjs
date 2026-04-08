/**
 * bulk-index-pinecone.mjs
 *
 * Bulk-indexes all authors and books into Pinecone library-rag index.
 * Processes items in batches with delays to respect Gemini rate limits.
 * Skips items with insufficient text.
 *
 * Usage:
 *   node bulk-index-pinecone.mjs [--authors-only | --books-only]
 */

import mysql from "mysql2/promise";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenAI } from "@google/genai";

// ── Config ────────────────────────────────────────────────────────────────────
const PINECONE_INDEX = "library-rag";
const EMBEDDING_MODEL = "models/gemini-embedding-001";
const BATCH_SIZE = 5;       // items per batch (conservative for rate limits)
const DELAY_MS = 800;       // delay between batches

// ── Init clients ──────────────────────────────────────────────────────────────
const pineconeApiKey = process.env.PINECONE_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!pineconeApiKey) { console.error("PINECONE_API_KEY not set"); process.exit(1); }
if (!geminiApiKey) { console.error("GEMINI_API_KEY not set"); process.exit(1); }
if (!databaseUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

const pc = new Pinecone({ apiKey: pineconeApiKey });
const genai = new GoogleGenAI({ apiKey: geminiApiKey });
const index = pc.index(PINECONE_INDEX);

// ── DB connection ─────────────────────────────────────────────────────────────
function parseDbUrl(url) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error("Cannot parse DATABASE_URL");
  const [, user, password, host, port, database] = match;
  return { host, port: parseInt(port), user, password, database };
}

async function getDb() {
  const cfg = parseDbUrl(databaseUrl);
  return mysql.createConnection({
    ...cfg,
    ssl: { rejectUnauthorized: true },
  });
}

// ── Embedding ─────────────────────────────────────────────────────────────────
async function embedText(text) {
  const result = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [{ parts: [{ text: text.slice(0, 8192) }] }],
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) throw new Error("Empty embedding returned");
  return values;
}

// ── Text chunking ─────────────────────────────────────────────────────────────
function chunkText(text, maxLen, overlap) {
  maxLen = maxLen || 2000;
  overlap = overlap || 200;
  if (!text || text.length === 0) return [];
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ── Upsert helpers ────────────────────────────────────────────────────────────
async function upsertAuthor(author) {
  let bioText = author.bio || "";
  if (author.richBioJson) {
    try {
      const rich = JSON.parse(author.richBioJson);
      const richBio = rich.fullBio || rich.bio || "";
      if (richBio.length > bioText.length) bioText = richBio;
    } catch (e) { /* use plain bio */ }
  }
  if (bioText.length < 50) {
    return { skipped: true, reason: "bio too short" };
  }
  const chunks = chunkText(bioText, 3000, 300);
  let upserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const values = await embedText(chunks[i]);
    const record = {
      id: "author-" + author.id + "-" + i,
      values: values,
      metadata: {
        contentType: "author",
        sourceId: String(author.id),
        title: author.authorName,
        authorName: author.authorName,
        source: "library",
        chunkIndex: i,
        chunkTotal: chunks.length,
        text: chunks[i],
      },
    };
    await index.namespace("authors").upsert({ records: [record] });
    upserted++;
  }
  return { skipped: false, chunks: upserted };
}

async function upsertBook(book) {
  const parts = [];
  if (book.summary) parts.push(book.summary);
  if (book.keyThemes) parts.push(book.keyThemes);
  const text = parts.join(" ") || book.bookTitle;
  if (text.length < 30) {
    return { skipped: true, reason: "text too short" };
  }
  const chunks = chunkText(text, 2000, 200);
  let upserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const values = await embedText(chunks[i]);
    const record = {
      id: "book-" + book.id + "-" + i,
      values: values,
      metadata: {
        contentType: "book",
        sourceId: String(book.id),
        title: book.bookTitle,
        authorName: book.authorName || undefined,
        source: "library",
        chunkIndex: i,
        chunkTotal: chunks.length,
        text: chunks[i],
      },
    };
    await index.namespace("books").upsert({ records: [record] });
    upserted++;
  }
  return { skipped: false, chunks: upserted };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const authorsOnly = args.includes("--authors-only");
const booksOnly = args.includes("--books-only");

const doAuthors = !booksOnly;
const doBooks = !authorsOnly;

const db = await getDb();
console.log("Connected to database.");

// ── Index Authors ─────────────────────────────────────────────────────────────
if (doAuthors) {
  console.log("\n=== INDEXING AUTHORS ===");
  const [authors] = await db.query(
    "SELECT id, authorName, bio, richBioJson FROM author_profiles ORDER BY id"
  );
  console.log("Found " + authors.length + " authors to index");
  
  let succeeded = 0, skipped = 0, failed = 0;
  for (let i = 0; i < authors.length; i += BATCH_SIZE) {
    const batch = authors.slice(i, i + BATCH_SIZE);
    for (const author of batch) {
      try {
        const result = await upsertAuthor(author);
        if (result.skipped) {
          skipped++;
        } else {
          succeeded++;
          console.log("  OK [" + author.id + "] " + author.authorName + " (" + result.chunks + " chunks)");
        }
      } catch (err) {
        failed++;
        console.error("  FAIL [" + author.id + "] " + author.authorName + ": " + err.message);
      }
    }
    const progress = Math.min(i + BATCH_SIZE, authors.length);
    console.log("Progress: " + progress + "/" + authors.length + " | OK: " + succeeded + " | Skip: " + skipped + " | Fail: " + failed);
    if (i + BATCH_SIZE < authors.length) {
      await new Promise(function(r) { setTimeout(r, DELAY_MS); });
    }
  }
  console.log("\nAuthors done: " + succeeded + " indexed, " + skipped + " skipped, " + failed + " failed");
}

// ── Index Books ───────────────────────────────────────────────────────────────
if (doBooks) {
  console.log("\n=== INDEXING BOOKS ===");
  const [books] = await db.query(
    "SELECT id, bookTitle, authorName, summary, keyThemes FROM book_profiles ORDER BY id"
  );
  console.log("Found " + books.length + " books to index");
  
  let succeeded = 0, skipped = 0, failed = 0;
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    for (const book of batch) {
      try {
        const result = await upsertBook(book);
        if (result.skipped) {
          skipped++;
        } else {
          succeeded++;
          console.log("  OK [" + book.id + "] " + book.bookTitle + " (" + result.chunks + " chunks)");
        }
      } catch (err) {
        failed++;
        console.error("  FAIL [" + book.id + "] " + book.bookTitle + ": " + err.message);
      }
    }
    const progress = Math.min(i + BATCH_SIZE, books.length);
    console.log("Progress: " + progress + "/" + books.length + " | OK: " + succeeded + " | Skip: " + skipped + " | Fail: " + failed);
    if (i + BATCH_SIZE < books.length) {
      await new Promise(function(r) { setTimeout(r, DELAY_MS); });
    }
  }
  console.log("\nBooks done: " + succeeded + " indexed, " + skipped + " skipped, " + failed + " failed");
}

await db.end();
console.log("\n=== BULK INDEXING COMPLETE ===");

// Final stats
const stats = await index.describeIndexStats();
console.log("\nPinecone library-rag stats:");
console.log("  Total vectors: " + (stats.totalRecordCount || 0));
if (stats.namespaces) {
  for (const [ns, nsStats] of Object.entries(stats.namespaces)) {
    console.log("  Namespace \"" + ns + "\": " + (nsStats.recordCount || 0) + " vectors");
  }
}
