/**
 * S3 CDN Audit & Migration Script
 *
 * Runs directly against the database to:
 *   1. Count all author avatars and book covers
 *   2. Identify which are NOT on S3 (no s3AvatarUrl / s3CoverUrl)
 *   3. Fetch and re-upload them to S3 in batches
 *   4. Update the DB with the new CDN URLs
 *
 * Usage:  node scripts/runS3Audit.mjs [--dry-run] [--limit 50]
 */
import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const BATCH_LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 200;

console.log(`\n🔍  S3 CDN Audit  [${DRY_RUN ? 'DRY RUN' : 'LIVE'}]  batch-limit=${BATCH_LIMIT}\n`);

// ── DB connection ─────────────────────────────────────────────────────────────
import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

// ── S3 helpers ────────────────────────────────────────────────────────────────
const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

function isS3Url(url) {
  if (!url) return false;
  return (
    url.includes('forge-api') ||
    url.includes('manus.space') ||
    url.includes('amazonaws.com') ||
    url.includes('s3.') ||
    url.includes('cdn.')
  );
}

function inferMime(url) {
  const lower = (url || '').toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

function makeS3Key(prefix, sourceUrl) {
  let hash = 0;
  for (let i = 0; i < sourceUrl.length; i++) {
    const char = sourceUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  const mime = inferMime(sourceUrl);
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
  const ext = extMap[mime] ?? 'jpg';
  return `${prefix}/${hashHex}.${ext}`;
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NCGLibrary/1.0)',
      'Accept': 'image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

async function uploadToS3(key, buffer, contentType) {
  // Use Manus Forge storage API
  const formData = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  formData.append('file', blob, key.split('/').pop());
  formData.append('key', key);

  const res = await fetch(`${FORGE_URL}/storage/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FORGE_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.url || json.data?.url || json.fileUrl;
}

async function mirrorToS3(sourceUrl, prefix) {
  const key = makeS3Key(prefix, sourceUrl);
  const { buffer, contentType } = await fetchBuffer(sourceUrl);
  const url = await uploadToS3(key, buffer, contentType);
  return { url, key };
}

// ── Audit Phase ───────────────────────────────────────────────────────────────
console.log('📊  Querying database...\n');

const [authorRows] = await db.query(
  'SELECT id, authorName, avatarUrl, s3AvatarUrl FROM author_profiles LIMIT 5000'
);
const [bookRows] = await db.query(
  'SELECT id, bookTitle, coverImageUrl, s3CoverUrl, s3CoverKey FROM book_profiles LIMIT 5000'
);

const totalAuthors = authorRows.length;
const totalBooks = bookRows.length;

const authorsNeedingMigration = authorRows.filter(a => a.avatarUrl && !isS3Url(a.s3AvatarUrl));
const booksNeedingMigration = bookRows.filter(b => b.coverImageUrl && !isS3Url(b.s3CoverUrl));
const authorsOnS3 = authorRows.filter(a => isS3Url(a.s3AvatarUrl));
const booksOnS3 = bookRows.filter(b => isS3Url(b.s3CoverUrl));
const authorsNoImage = authorRows.filter(a => !a.avatarUrl && !a.s3AvatarUrl);
const booksNoImage = bookRows.filter(b => !b.coverImageUrl && !b.s3CoverUrl);

console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│                     AUDIT RESULTS                          │');
console.log('├─────────────────────────────────────────────────────────────┤');
console.log(`│  Authors: ${totalAuthors} total`);
console.log(`│    ✅  Already on S3:       ${authorsOnS3.length}`);
console.log(`│    🔄  Need migration:      ${authorsNeedingMigration.length}`);
console.log(`│    ❌  No image at all:     ${authorsNoImage.length}`);
console.log(`│`);
console.log(`│  Books: ${totalBooks} total`);
console.log(`│    ✅  Already on S3:       ${booksOnS3.length}`);
console.log(`│    🔄  Need migration:      ${booksNeedingMigration.length}`);
console.log(`│    ❌  No image at all:     ${booksNoImage.length}`);
console.log('└─────────────────────────────────────────────────────────────┘\n');

if (DRY_RUN) {
  console.log('DRY RUN — no uploads performed.\n');
  
  if (authorsNeedingMigration.length > 0) {
    console.log('Sample authors needing migration:');
    authorsNeedingMigration.slice(0, 5).forEach(a => {
      console.log(`  - ${a.authorName}: ${(a.avatarUrl || '').slice(0, 80)}`);
    });
  }
  if (booksNeedingMigration.length > 0) {
    console.log('\nSample books needing migration:');
    booksNeedingMigration.slice(0, 5).forEach(b => {
      console.log(`  - ${b.bookTitle}: ${(b.coverImageUrl || '').slice(0, 80)}`);  
    });
  }
  await db.end();
  process.exit(0);
}

// ── Migration Phase ───────────────────────────────────────────────────────────
const CONCURRENCY = 5; // parallel uploads

async function processBatch(items, type) {
  const results = { succeeded: 0, failed: 0, errors: [] };
  const batches = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    batches.push(items.slice(i, i + CONCURRENCY));
  }
  
  let processed = 0;
  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const sourceUrl = type === 'avatar' ? item.avatarUrl : item.coverImageUrl;
        const prefix = type === 'avatar' ? 'author-avatars' : 'book-covers';
        const { url, key } = await mirrorToS3(sourceUrl, prefix);
        
        if (type === 'avatar') {
          await db.query(
            'UPDATE author_profiles SET s3AvatarUrl = ? WHERE id = ?',
            [url, item.id]
          );
        } else {
          await db.query(
            'UPDATE book_profiles SET s3CoverUrl = ?, s3CoverKey = ? WHERE id = ?',
            [url, key, item.id]
          );
        }
        return { id: item.id, url };
      })
    );
    
    for (let i = 0; i < batchResults.length; i++) {
      const r = batchResults[i];
      if (r.status === 'fulfilled') {
        results.succeeded++;
      } else {
        results.failed++;
        const item = batch[i];
        const name = type === 'avatar' ? item.author_name : item.book_title;
        results.errors.push(`${name}: ${r.reason?.message || r.reason}`);
      }
    }
    
    processed += batch.length;
    const total = items.length;
    process.stdout.write(`\r  Progress: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
  }
  console.log('');
  return results;
}

// Migrate avatars
const avatarBatch = authorsNeedingMigration.slice(0, BATCH_LIMIT);
if (avatarBatch.length > 0) {
  console.log(`\n🖼️   Migrating ${avatarBatch.length} author avatars to S3...`);
  const avatarResults = await processBatch(avatarBatch, 'avatar');
  console.log(`  ✅  Succeeded: ${avatarResults.succeeded}`);
  console.log(`  ❌  Failed:    ${avatarResults.failed}`);
  if (avatarResults.errors.length > 0) {
    console.log('  Errors:');
    avatarResults.errors.slice(0, 10).forEach(e => console.log(`    - ${e}`));
  }
} else {
  console.log('\n✅  All author avatars are already on S3!');
}

// Migrate covers
const coverBatch = booksNeedingMigration.slice(0, BATCH_LIMIT);
if (coverBatch.length > 0) {
  console.log(`\n📚  Migrating ${coverBatch.length} book covers to S3...`);
  const coverResults = await processBatch(coverBatch, 'cover');
  console.log(`  ✅  Succeeded: ${coverResults.succeeded}`);
  console.log(`  ❌  Failed:    ${coverResults.failed}`);
  if (coverResults.errors.length > 0) {
    console.log('  Errors:');
    coverResults.errors.slice(0, 10).forEach(e => console.log(`    - ${e}`));
  }
} else {
  console.log('\n✅  All book covers are already on S3!');
}

// ── Final Report ──────────────────────────────────────────────────────────────
console.log('\n\n📊  FINAL STATUS:');
const [finalAuthors] = await db.query(
  "SELECT COUNT(*) as total, SUM(CASE WHEN s3AvatarUrl IS NOT NULL AND s3AvatarUrl != '' THEN 1 ELSE 0 END) as on_s3 FROM author_profiles"
);
const [finalBooks] = await db.query(
  "SELECT COUNT(*) as total, SUM(CASE WHEN s3CoverUrl IS NOT NULL AND s3CoverUrl != '' THEN 1 ELSE 0 END) as on_s3 FROM book_profiles"
);

const fa = finalAuthors[0];
const fb = finalBooks[0];
console.log(`  Authors: ${fa.on_s3}/${fa.total} on S3 (${Math.round(fa.on_s3/fa.total*100)}%)`);
console.log(`  Books:   ${fb.on_s3}/${fb.total} on S3 (${Math.round(fb.on_s3/fb.total*100)}%)`);

await db.end();
console.log('\n✅  Audit complete!\n');
