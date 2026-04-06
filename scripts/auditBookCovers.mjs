import 'dotenv/config';
import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

const [books] = await db.query(
  'SELECT id, bookTitle, authorName, coverImageUrl, s3CoverUrl, amazonUrl FROM book_profiles ORDER BY bookTitle'
);

let amazonCount = 0, googleCount = 0, openLibCount = 0, cloudFrontCount = 0, otherCount = 0, nullCount = 0;

for (const b of books) {
  const url = b.coverImageUrl || '';
  if (!url) nullCount++;
  else if (url.includes('amazon') || url.includes('media-amazon')) amazonCount++;
  else if (url.includes('books.google')) googleCount++;
  else if (url.includes('openlibrary')) openLibCount++;
  else if (url.includes('cloudfront')) cloudFrontCount++;
  else otherCount++;
}

console.log('=== Book Cover Source Audit ===');
console.log('Total books:', books.length);
console.log('Amazon (media-amazon.com):', amazonCount, '— high-res ✅');
console.log('Google Books:', googleCount, '— low-res ⚠️');
console.log('OpenLibrary:', openLibCount, '— medium-res ⚠️');
console.log('CloudFront (already CDN):', cloudFrontCount);
console.log('Other:', otherCount);
console.log('No cover:', nullCount);

const nonAmazon = books.filter(b => {
  const url = b.coverImageUrl || '';
  return url && !url.includes('amazon') && !url.includes('media-amazon');
});

console.log('\nNon-Amazon covers that need re-scraping:', nonAmazon.length);
console.log('\nSample non-Amazon covers:');
nonAmazon.slice(0, 15).forEach(b => {
  console.log(`  [${b.id}] ${b.bookTitle} -> ${(b.coverImageUrl || '').slice(0, 80)}`);
});

// Also check which books have amazonUrl set (useful for direct cover fetch)
const withAmazonUrl = books.filter(b => b.amazonUrl && b.amazonUrl.includes('amazon.com'));
console.log('\nBooks with amazonUrl set:', withAmazonUrl.length);

await db.end();
