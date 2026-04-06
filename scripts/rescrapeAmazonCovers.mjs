/**
 * Amazon Book Cover Re-Scraping Pipeline
 *
 * For each book with a non-Amazon cover (Google Books / OpenLibrary):
 *   1. If amazonUrl is a /dp/ product page → scrape the product page directly
 *   2. Otherwise → search Amazon by title + author
 *   3. Upgrade to high-res (_SX600_)
 *   4. Upload to S3 CDN via Manus Forge API
 *   5. Update coverImageUrl + s3CoverUrl + s3CoverKey in DB
 *
 * Usage:
 *   node scripts/rescrapeAmazonCovers.mjs [--dry-run] [--concurrency 3] [--limit 50]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { ApifyClient } from 'apify-client';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const concurrencyArg = args.indexOf('--concurrency');
const CONCURRENCY = concurrencyArg !== -1 ? parseInt(args[concurrencyArg + 1], 10) : 3;
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 999;

console.log(`\n📚  Amazon Cover Re-Scraper  [${DRY_RUN ? 'DRY RUN' : 'LIVE'}]  concurrency=${CONCURRENCY}  limit=${LIMIT}\n`);

// ── DB ────────────────────────────────────────────────────────────────────────
const db = await mysql.createConnection(process.env.DATABASE_URL);

// ── Apify ─────────────────────────────────────────────────────────────────────
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN not set');
const apify = new ApifyClient({ token: APIFY_TOKEN });
const ACTOR_ID = 'apify/cheerio-scraper';

// ── S3 / Forge ────────────────────────────────────────────────────────────────
const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function inferMime(url) {
  const lower = (url || '').toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
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
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const ext = extMap[inferMime(sourceUrl)] ?? 'jpg';
  return `${prefix}/${hashHex}.${ext}`;
}

async function uploadToS3(key, buffer, contentType) {
  // Use the correct Forge API endpoint: v1/storage/upload?path=<key>
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
    throw new Error(`S3 upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.url || json.data?.url || json.fileUrl;
}

async function fetchAndUpload(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NCGLibrary/1.0)', Accept: 'image/*,*/*' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${imageUrl}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  const key = makeS3Key('book-covers', imageUrl);
  const cdnUrl = await uploadToS3(key, buffer, contentType);
  return { cdnUrl, key };
}

async function runApify(startUrls, pageFunction, label) {
  const run = await apify.actor(ACTOR_ID).call(
    {
      startUrls,
      pageFunction,
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      proxyConfiguration: { useApifyProxy: true },
    },
    { memory: 256, waitSecs: 120 }
  );
  if (run.status !== 'SUCCEEDED') {
    console.warn(`  [Apify] Run ${run.status} for "${label}"`);
    return null;
  }
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items ?? [];
}

// ── Page functions ─────────────────────────────────────────────────────────────
const PRODUCT_PAGE_FN = `
async function pageFunction(context) {
  const { $, request, log } = context;
  // Try multiple selectors for the main product image
  const selectors = [
    '#imgBlkFront',
    '#ebooksImgBlkFront',
    '#main-image',
    '#landingImage',
    'img#imgBlkFront',
    '.a-dynamic-image[data-a-dynamic-image]',
    '#imageBlock img',
    '#img-canvas img',
    '#imageBlockContainer img',
    '.imgTagWrapper img',
  ];
  let imgSrc = null;
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      // Try data-a-dynamic-image first (JSON map of url -> [w,h])
      const dynData = el.attr('data-a-dynamic-image');
      if (dynData) {
        try {
          const map = JSON.parse(dynData);
          const urls = Object.keys(map);
          // Pick the largest image
          const best = urls.sort((a, b) => {
            const [wa, ha] = map[a];
            const [wb, hb] = map[b];
            return (wb * hb) - (wa * ha);
          })[0];
          if (best) { imgSrc = best; break; }
        } catch(e) {}
      }
      const src = el.attr('src');
      if (src && src.includes('media-amazon.com')) { imgSrc = src; break; }
    }
  }
  // Fallback: find any media-amazon.com image on the page
  if (!imgSrc) {
    $('img').each((i, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('media-amazon.com') && !imgSrc) imgSrc = src;
    });
  }
  log.info('Found image: ' + (imgSrc || 'none'));
  return [{ coverUrl: imgSrc, pageUrl: request.url }];
}
`;

const SEARCH_PAGE_FN = `
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
  log.info('Found ' + results.length + ' search results');
  return results.slice(0, 5);
}
`;

// ── Load books needing re-scrape ──────────────────────────────────────────────
const [allBooks] = await db.query(
  'SELECT id, bookTitle, authorName, coverImageUrl, s3CoverUrl, s3CoverKey, amazonUrl FROM book_profiles ORDER BY bookTitle'
);

const toRescrape = allBooks.filter(b => {
  const url = b.coverImageUrl || '';
  return url && !url.includes('amazon') && !url.includes('media-amazon');
}).slice(0, LIMIT);

console.log(`Books needing Amazon re-scrape: ${toRescrape.length}`);

if (DRY_RUN) {
  console.log('\nDRY RUN — first 10 books that would be processed:');
  toRescrape.slice(0, 10).forEach(b => {
    const hasDP = b.amazonUrl && b.amazonUrl.includes('/dp/');
    console.log(`  [${b.id}] ${b.bookTitle} (${hasDP ? 'product page' : 'search'}) — ${b.coverImageUrl?.slice(0, 60)}`);
  });
  await db.end();
  process.exit(0);
}

// ── Process in parallel batches ───────────────────────────────────────────────
const results = { succeeded: 0, failed: 0, notFound: 0, errors: [] };

async function processBook(book) {
  const hasDP = book.amazonUrl && book.amazonUrl.includes('/dp/');
  let coverUrl = null;
  let newAmazonUrl = book.amazonUrl;

  try {
    if (hasDP) {
      // Scrape product page directly
      const items = await runApify(
        [{ url: book.amazonUrl }],
        PRODUCT_PAGE_FN,
        book.bookTitle
      );
      if (items && items.length > 0 && items[0].coverUrl) {
        coverUrl = upgradeAmazonRes(items[0].coverUrl);
      }
    }

    // Fallback to search if product page didn't work
    if (!coverUrl) {
      const query = encodeURIComponent(`${book.bookTitle} ${book.authorName || ''}`);
      const searchUrl = `https://www.amazon.com/s?k=${query}&i=stripbooks`;
      const items = await runApify([{ url: searchUrl }], SEARCH_PAGE_FN, book.bookTitle);
      if (items && items.length > 0) {
        const titleLower = book.bookTitle.toLowerCase();
        const sorted = [...items].sort((a, b) => {
          const aM = String(a.title || '').toLowerCase().includes(titleLower) ? 0 : 1;
          const bM = String(b.title || '').toLowerCase().includes(titleLower) ? 0 : 1;
          return aM - bM;
        });
        const best = sorted[0];
        if (best?.coverUrl) {
          coverUrl = upgradeAmazonRes(best.coverUrl);
          if (best.amazonUrl) newAmazonUrl = best.amazonUrl;
        }
      }
    }

    if (!coverUrl) {
      console.log(`  ❌  Not found: ${book.bookTitle}`);
      results.notFound++;
      return;
    }

    // Upload to S3
    const { cdnUrl, key } = await fetchAndUpload(coverUrl);

    // Update DB
    await db.query(
      'UPDATE book_profiles SET coverImageUrl = ?, s3CoverUrl = ?, s3CoverKey = ?, amazonUrl = ? WHERE id = ?',
      [coverUrl, cdnUrl, key, newAmazonUrl, book.id]
    );

    console.log(`  ✅  ${book.bookTitle} → ${cdnUrl.slice(0, 80)}`);
    results.succeeded++;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌  ${book.bookTitle}: ${msg.slice(0, 100)}`);
    results.failed++;
    results.errors.push(`${book.bookTitle}: ${msg.slice(0, 100)}`);
  }
}

// Run with concurrency limit
let idx = 0;
const total = toRescrape.length;

async function worker() {
  while (idx < total) {
    const book = toRescrape[idx++];
    const pos = idx;
    process.stdout.write(`\r[${pos}/${total}] Processing: ${book.bookTitle.slice(0, 40).padEnd(40)}`);
    await processBook(book);
  }
}

const workers = Array.from({ length: CONCURRENCY }, () => worker());
await Promise.all(workers);
console.log('\n');

// ── Final report ──────────────────────────────────────────────────────────────
console.log('=== RESULTS ===');
console.log(`  ✅  Succeeded:  ${results.succeeded}`);
console.log(`  ❌  Not found:  ${results.notFound}`);
console.log(`  ⚠️   Errors:     ${results.failed}`);
if (results.errors.length > 0) {
  console.log('\nErrors:');
  results.errors.slice(0, 20).forEach(e => console.log('  -', e));
}

// Final DB stats
const [finalStats] = await db.query(
  "SELECT COUNT(*) as total, SUM(CASE WHEN coverImageUrl LIKE '%media-amazon%' OR coverImageUrl LIKE '%amazon%' THEN 1 ELSE 0 END) as amazon_count, SUM(CASE WHEN s3CoverUrl LIKE '%cloudfront%' THEN 1 ELSE 0 END) as on_cdn FROM book_profiles"
);
const s = finalStats[0];
console.log(`\nFinal state: ${s.amazon_count}/${s.total} Amazon covers, ${s.on_cdn}/${s.total} on CDN`);

await db.end();
console.log('\n✅  Done!\n');
