/**
 * Retry script for the 29 books that failed the first Amazon scraping pass.
 * Uses title-only search (no author) and alternate title variants.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { ApifyClient } from 'apify-client';

const db = await mysql.createConnection(process.env.DATABASE_URL);
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const apify = new ApifyClient({ token: APIFY_TOKEN });
const ACTOR_ID = 'apify/cheerio-scraper';
const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

function upgradeAmazonRes(url) {
  if (!url || !url.includes('media-amazon.com')) return url;
  return url
    .replace(/\._AC_UY\d+_\./g, '._SX600_.')
    .replace(/\._AC_UL\d+_\./g, '._SX600_.')
    .replace(/\._AC_SX\d+_\./g, '._SX600_.')
    .replace(/\._SX\d+_\./g, '._SX600_.')
    .replace(/\._SY\d+_\./g, '._SX600_.')
    .replace(/\._SL\d+_\./g, '._SX600_.');
}

function makeS3Key(sourceUrl) {
  let hash = 0;
  for (let i = 0; i < sourceUrl.length; i++) {
    const char = sourceUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return `book-covers/${hashHex}.jpg`;
}

async function uploadToS3(key, buffer, contentType) {
  const normalizedKey = key.replace(/^\/+/, '');
  const forgeBase = FORGE_URL.replace(/\/+$/, '');
  const uploadUrl = `${forgeBase}/v1/storage/upload?path=${encodeURIComponent(normalizedKey)}`;
  const formData = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  formData.append('file', blob, normalizedKey.split('/').pop() || 'file');
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FORGE_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.url;
}

async function fetchAndUpload(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NCGLibrary/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const key = makeS3Key(imageUrl);
  const cdnUrl = await uploadToS3(key, buffer, 'image/jpeg');
  return { cdnUrl, key };
}

const SEARCH_FN = `
async function pageFunction(context) {
  const { $, request, log } = context;
  const results = [];
  $('.s-result-item[data-asin]').each((i, el) => {
    const asin = $(el).attr('data-asin');
    if (!asin || asin.length < 5) return;
    const title = $(el).find('h2 span').first().text().trim();
    const img = $(el).find('img.s-image').attr('src');
    const href = $(el).find('h2 a').attr('href');
    if (title && img) {
      results.push({ asin, title, coverUrl: img, amazonUrl: href ? 'https://www.amazon.com' + href.split('?')[0] : 'https://www.amazon.com/dp/' + asin });
    }
  });
  log.info('Found ' + results.length + ' results');
  return results.slice(0, 5);
}
`;

async function runSearch(query, label) {
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=stripbooks`;
  const run = await apify.actor(ACTOR_ID).call(
    { startUrls: [{ url: searchUrl }], pageFunction: SEARCH_FN, maxRequestsPerCrawl: 1, maxConcurrency: 1, proxyConfiguration: { useApifyProxy: true } },
    { memory: 256, waitSecs: 120 }
  );
  if (run.status !== 'SUCCEEDED') return null;
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items ?? [];
}

// Load the 29 remaining books
const [books] = await db.query(
  "SELECT id, bookTitle, authorName, coverImageUrl, amazonUrl FROM book_profiles WHERE coverImageUrl NOT LIKE '%amazon%' AND coverImageUrl NOT LIKE '%media-amazon%' ORDER BY bookTitle"
);

console.log(`\n🔄  Retry pass for ${books.length} books\n`);

let succeeded = 0, failed = 0;

for (const book of books) {
  const title = book.bookTitle;
  console.log(`  Processing: ${title}`);
  
  try {
    // Try title-only search first (more lenient)
    let items = await runSearch(title + ' book', title);
    
    // If nothing, try with author
    if (!items || items.length === 0) {
      items = await runSearch(`${title} ${book.authorName || ''}`, title);
    }
    
    if (!items || items.length === 0) {
      console.log(`    ❌ No results`);
      failed++;
      continue;
    }
    
    const titleLower = title.toLowerCase();
    const sorted = [...items].sort((a, b) => {
      const aM = String(a.title || '').toLowerCase().includes(titleLower) ? 0 : 1;
      const bM = String(b.title || '').toLowerCase().includes(titleLower) ? 0 : 1;
      return aM - bM;
    });
    
    const best = sorted[0];
    if (!best?.coverUrl) {
      console.log(`    ❌ No cover in results`);
      failed++;
      continue;
    }
    
    const coverUrl = upgradeAmazonRes(best.coverUrl);
    const { cdnUrl, key } = await fetchAndUpload(coverUrl);
    
    await db.query(
      'UPDATE book_profiles SET coverImageUrl = ?, s3CoverUrl = ?, s3CoverKey = ?, amazonUrl = ? WHERE id = ?',
      [coverUrl, cdnUrl, key, best.amazonUrl || book.amazonUrl, book.id]
    );
    
    console.log(`    ✅ ${title} → ${cdnUrl.slice(0, 70)}`);
    succeeded++;
    
  } catch (err) {
    console.error(`    ❌ ${title}: ${err.message?.slice(0, 80)}`);
    failed++;
  }
}

console.log(`\n=== RETRY RESULTS ===`);
console.log(`  ✅ Succeeded: ${succeeded}`);
console.log(`  ❌ Failed:    ${failed}`);

// Final stats
const [stats] = await db.query(
  "SELECT COUNT(*) as total, SUM(CASE WHEN coverImageUrl LIKE '%media-amazon%' OR coverImageUrl LIKE '%amazon%' THEN 1 ELSE 0 END) as amazon, SUM(CASE WHEN s3CoverUrl LIKE '%cloudfront%' THEN 1 ELSE 0 END) as cdn FROM book_profiles"
);
const s = stats[0];
console.log(`\nFinal: ${s.amazon}/${s.total} Amazon covers, ${s.cdn}/${s.total} on CDN`);

await db.end();
