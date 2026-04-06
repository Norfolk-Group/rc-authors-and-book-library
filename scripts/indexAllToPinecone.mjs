/**
 * Full Pinecone indexing pipeline for the NCG Library.
 * Processes records in small batches to avoid OOM with 3072-dim vectors.
 *
 * Uses Gemini gemini-embedding-001 (3072-dim) for embeddings.
 * Run with: node --max-old-space-size=512 scripts/indexAllToPinecone.mjs
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';

// ── Config ────────────────────────────────────────────────────────────────────
const PINECONE_INDEX_NAME = 'library-rag';
const EMBEDDING_DIMENSION = 3072;
const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const PROCESS_BATCH = 5; // Process 5 records at a time to keep memory low
const UPSERT_BATCH = 50; // Pinecone upsert batch size

// ── Clients ───────────────────────────────────────────────────────────────────
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const db = await mysql.createConnection(process.env.DATABASE_URL);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function embedText(text) {
  const result = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [{ parts: [{ text: text.slice(0, 8192) }] }],
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) throw new Error('Empty embedding returned');
  return values;
}

function chunkText(text, chunkSize = 2000, overlap = 200) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= chunkSize) return [cleaned];
  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    let breakPoint = end;
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      const lastNewline = cleaned.lastIndexOf('\n', end);
      const boundary = Math.max(lastPeriod, lastNewline);
      if (boundary > start + chunkSize / 2) breakPoint = boundary + 1;
    }
    chunks.push(cleaned.slice(start, breakPoint).trim());
    start = breakPoint - overlap;
  }
  return chunks.filter(c => c.length > 50);
}

function makeVectorId(type, sourceId, chunkIndex) {
  const safe = String(sourceId).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);
  return `${type}-${safe}-chunk${chunkIndex}`;
}

/**
 * Embed text, create vectors, and upsert to Pinecone — all in one pass.
 * Immediately releases memory after each record.
 */
async function processRecord(index, namespace, id, type, text, metadata) {
  const chunks = chunkText(text);
  let vectorCount = 0;
  const vectors = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    vectors.push({
      id: makeVectorId(type, id, i),
      values: embedding,
      metadata: { ...metadata, chunkIndex: i, chunkText: chunks[i].slice(0, 300) },
    });
    // Upsert in batches to avoid holding all vectors in memory
    if (vectors.length >= UPSERT_BATCH) {
      const ns = index.namespace(namespace);
      await ns.upsert({ records: vectors.splice(0) }); // splice clears the array
      vectorCount += UPSERT_BATCH;
    }
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 80));
  }

  // Upsert remaining vectors
  if (vectors.length > 0) {
    const ns = index.namespace(namespace);
    await ns.upsert({ records: vectors });
    vectorCount += vectors.length;
  }

  return vectorCount;
}

// ── Step 1: Ensure index exists ───────────────────────────────────────────────
console.log('\n📌  Step 1: Ensuring Pinecone index exists...');
const { indexes } = await pc.listIndexes();
const exists = (indexes ?? []).some(idx => idx.name === PINECONE_INDEX_NAME);

if (!exists) {
  console.log(`  Creating index "${PINECONE_INDEX_NAME}" (dim=${EMBEDDING_DIMENSION}, metric=cosine)...`);
  await pc.createIndex({
    name: PINECONE_INDEX_NAME,
    dimension: EMBEDDING_DIMENSION,
    metric: 'cosine',
    spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    waitUntilReady: true,
  });
  console.log(`  ✅ Index created and ready (dim=${EMBEDDING_DIMENSION}).`);
} else {
  console.log(`  ✅ Index "${PINECONE_INDEX_NAME}" already exists.`);
}

const index = pc.index(PINECONE_INDEX_NAME);

// ── Step 2: Index books ───────────────────────────────────────────────────────
console.log('\n📚  Step 2: Indexing books...');
const [bookIds] = await db.query(
  'SELECT id FROM book_profiles WHERE summary IS NOT NULL AND LENGTH(summary) > 50 ORDER BY id'
);
console.log(`  Found ${bookIds.length} books to index.`);

let booksIndexed = 0, booksSkipped = 0, bookVectors = 0;
for (let i = 0; i < bookIds.length; i += PROCESS_BATCH) {
  const batch = bookIds.slice(i, i + PROCESS_BATCH);
  const ids = batch.map(b => b.id);
  const [books] = await db.query(
    `SELECT id, bookTitle, authorName, summary, richSummaryJson FROM book_profiles WHERE id IN (${ids.join(',')}) ORDER BY id`
  );

  for (const book of books) {
    let text = book.summary ?? '';
    try {
      if (book.richSummaryJson) {
        const rich = typeof book.richSummaryJson === 'string' ? JSON.parse(book.richSummaryJson) : book.richSummaryJson;
        if (rich?.fullSummary && rich.fullSummary.length > text.length) text = rich.fullSummary;
        else if (rich?.summary && rich.summary.length > text.length) text = rich.summary;
      }
    } catch { /* use plain summary */ }
    if (text.length < 50) { booksSkipped++; continue; }
    try {
      const count = await processRecord(index, 'books', String(book.id), 'book', text, {
        type: 'book',
        bookId: String(book.id),
        title: book.bookTitle,
        authorName: book.authorName ?? '',
      });
      bookVectors += count;
      booksIndexed++;
    } catch (err) {
      console.error(`  ⚠️  Book "${book.bookTitle}": ${err.message?.slice(0, 60)}`);
      booksSkipped++;
    }
  }
  if ((i + PROCESS_BATCH) % 20 === 0 || i + PROCESS_BATCH >= bookIds.length) {
    console.log(`  [${Math.min(i + PROCESS_BATCH, bookIds.length)}/${bookIds.length}] books processed...`);
  }
}
console.log(`  ✅ Books: ${booksIndexed} indexed, ${booksSkipped} skipped, ${bookVectors} vectors`);

// ── Step 3: Index authors ─────────────────────────────────────────────────────
console.log('\n👤  Step 3: Indexing authors...');
const [authorIds] = await db.query(
  'SELECT id FROM author_profiles WHERE bio IS NOT NULL AND LENGTH(bio) > 50 ORDER BY id'
);
console.log(`  Found ${authorIds.length} authors to index.`);

let authorsIndexed = 0, authorsSkipped = 0, authorVectors = 0;
for (let i = 0; i < authorIds.length; i += PROCESS_BATCH) {
  const batch = authorIds.slice(i, i + PROCESS_BATCH);
  const ids = batch.map(b => b.id);
  const [authors] = await db.query(
    `SELECT id, authorName, bio, richBioJson FROM author_profiles WHERE id IN (${ids.join(',')}) ORDER BY id`
  );

  for (const author of authors) {
    let bioText = author.bio ?? '';
    try {
      if (author.richBioJson) {
        const rich = typeof author.richBioJson === 'string' ? JSON.parse(author.richBioJson) : author.richBioJson;
        if (rich?.fullBio && rich.fullBio.length > bioText.length) bioText = rich.fullBio;
      }
    } catch { /* use plain bio */ }
    if (bioText.length < 50) { authorsSkipped++; continue; }
    try {
      const count = await processRecord(index, 'authors', String(author.id), 'author', bioText, {
        type: 'author',
        authorId: String(author.id),
        authorName: author.authorName,
      });
      authorVectors += count;
      authorsIndexed++;
    } catch (err) {
      console.error(`  ⚠️  Author "${author.authorName}": ${err.message?.slice(0, 60)}`);
      authorsSkipped++;
    }
  }
  if ((i + PROCESS_BATCH) % 20 === 0 || i + PROCESS_BATCH >= authorIds.length) {
    console.log(`  [${Math.min(i + PROCESS_BATCH, authorIds.length)}/${authorIds.length}] authors processed...`);
  }
}
console.log(`  ✅ Authors: ${authorsIndexed} indexed, ${authorsSkipped} skipped, ${authorVectors} vectors`);

// ── Step 4: Index content items ───────────────────────────────────────────────
console.log('\n📄  Step 4: Indexing content items...');
const [itemIds] = await db.query(
  'SELECT id FROM content_items WHERE description IS NOT NULL AND LENGTH(description) > 50 ORDER BY id LIMIT 500'
);
console.log(`  Found ${itemIds.length} content items to index.`);

let itemsIndexed = 0, itemsSkipped = 0, itemVectors = 0;
for (let i = 0; i < itemIds.length; i += PROCESS_BATCH) {
  const batch = itemIds.slice(i, i + PROCESS_BATCH);
  const ids = batch.map(b => b.id);
  const [items] = await db.query(
    `SELECT id, title, contentType, url, description FROM content_items WHERE id IN (${ids.join(',')}) ORDER BY id`
  );

  for (const item of items) {
    const text = item.description ?? '';
    if (text.length < 50) { itemsSkipped++; continue; }
    try {
      const count = await processRecord(index, 'content_items', String(item.id), 'content_item', text, {
        type: 'content_item',
        itemId: String(item.id),
        title: item.title ?? '',
        contentType: item.contentType ?? 'unknown',
        url: item.url ?? '',
      });
      itemVectors += count;
      itemsIndexed++;
    } catch (err) {
      console.error(`  ⚠️  Item "${item.title}": ${err.message?.slice(0, 60)}`);
      itemsSkipped++;
    }
  }
  if ((i + PROCESS_BATCH) % 25 === 0 || i + PROCESS_BATCH >= itemIds.length) {
    console.log(`  [${Math.min(i + PROCESS_BATCH, itemIds.length)}/${itemIds.length}] content items processed...`);
  }
}
console.log(`  ✅ Content items: ${itemsIndexed} indexed, ${itemsSkipped} skipped, ${itemVectors} vectors`);

// ── Step 5: Index RAG files ───────────────────────────────────────────────────
console.log('\n🗂️   Step 5: Indexing RAG files...');
const [ragProfiles] = await db.query(
  "SELECT id, authorName, ragFileUrl, ragVersion FROM author_rag_profiles WHERE ragStatus = 'ready' AND ragFileUrl IS NOT NULL ORDER BY id"
);
console.log(`  Found ${ragProfiles.length} ready RAG files.`);

let ragsIndexed = 0, ragsSkipped = 0, ragVectors = 0;
for (const profile of ragProfiles) {
  try {
    const resp = await fetch(profile.ragFileUrl);
    if (!resp.ok) { ragsSkipped++; continue; }
    const ragContent = await resp.text();
    if (ragContent.length < 100) { ragsSkipped++; continue; }
    const count = await processRecord(index, 'rag_files', profile.authorName, 'rag_file', ragContent, {
      type: 'rag_file',
      authorName: profile.authorName,
      ragVersion: String(profile.ragVersion ?? 1),
    });
    ragVectors += count;
    ragsIndexed++;
    console.log(`  ✅ RAG: ${profile.authorName} (${count} vectors)`);
  } catch (err) {
    console.error(`  ⚠️  RAG "${profile.authorName}": ${err.message?.slice(0, 60)}`);
    ragsSkipped++;
  }
}
console.log(`  ✅ RAG files: ${ragsIndexed} indexed, ${ragsSkipped} skipped, ${ragVectors} vectors`);

// ── Final stats ───────────────────────────────────────────────────────────────
const totalVectors = bookVectors + authorVectors + itemVectors + ragVectors;
console.log('\n=== PINECONE INDEXING COMPLETE ===');
console.log(`  Books:         ${booksIndexed} indexed (${bookVectors} vectors)`);
console.log(`  Authors:       ${authorsIndexed} indexed (${authorVectors} vectors)`);
console.log(`  Content items: ${itemsIndexed} indexed (${itemVectors} vectors)`);
console.log(`  RAG files:     ${ragsIndexed} indexed (${ragVectors} vectors)`);
console.log(`  TOTAL VECTORS: ${totalVectors}`);

// Get final index stats
try {
  const stats = await index.describeIndexStats();
  console.log('\nPinecone index stats:');
  console.log('  Total vector count:', stats.totalRecordCount ?? stats.totalVectorCount ?? 'N/A');
  if (stats.namespaces) {
    for (const [ns, info] of Object.entries(stats.namespaces)) {
      console.log(`  Namespace "${ns}":`, info.recordCount ?? info.vectorCount ?? 'N/A', 'vectors');
    }
  }
} catch (err) {
  console.log('Could not fetch index stats:', err.message);
}

await db.end();
console.log('\n✅  Done!');
