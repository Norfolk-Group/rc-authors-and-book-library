/**
 * deepScanDropboxBackup.mjs
 * Deep scan: for each author folder, drill into Books/ subfolder
 * to find actual book titles and files, then compare against DB.
 */
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config();

const BASE = '/Cidale Interests/01_Companies/Norfolk AI/Apps/RC Library App/Authors and Books Backup';

async function getToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (refreshToken && appKey && appSecret) {
    const resp = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: appSecret,
      }),
    });
    const data = await resp.json();
    if (data.access_token) return data.access_token;
  }
  return process.env.DROPBOX_ACCESS_TOKEN;
}

async function listFolder(token, path) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive: false, limit: 2000 }),
  });
  const data = await resp.json();
  if (data.error) return [];
  let entries = data.entries || [];
  let cursor = data.cursor;
  let hasMore = data.has_more;
  while (hasMore) {
    const r2 = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor }),
    });
    const d2 = await r2.json();
    entries = entries.concat(d2.entries || []);
    cursor = d2.cursor;
    hasMore = d2.has_more;
  }
  return entries;
}

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripExt(name) {
  return name.replace(/\.(pdf|epub|mobi|mp3|mp4|m4a|docx?|txt|rtf)$/i, '').trim();
}

// Known folder names that are NOT book titles
const SYSTEM_FOLDERS = new Set(['books', 'published works', 'author profile', 'reference', 'articles', 'papers', 'media', 'podcasts', 'videos', 'notes', 'processed', 'inbox']);

async function main() {
  console.log('🔍 Getting Dropbox token...');
  const token = await getToken();
  console.log('✅ Token obtained\n');

  // Get all author folders
  const topLevel = await listFolder(token, BASE);
  const authorFolders = topLevel.filter(e => e['.tag'] === 'folder' && e.name !== 'Unknown' && e.name !== 'OutboundLabs');
  console.log(`📁 Found ${authorFolders.length} author folders\n`);

  // Connect to DB
  const conn = await createConnection(process.env.DATABASE_URL);
  const [dbAuthors] = await conn.execute('SELECT id, authorName FROM author_profiles');
  const [dbBooks] = await conn.execute('SELECT id, bookTitle, authorName FROM book_profiles');

  const dbAuthorMap = new Map(dbAuthors.map(a => [normalize(a.authorName), a]));
  const dbBookTitles = new Set(dbBooks.map(b => normalize(stripExt(b.bookTitle))));

  console.log(`🗄️  DB: ${dbAuthors.length} authors, ${dbBooks.length} books\n`);

  const results = {
    scannedAt: new Date().toISOString(),
    missingAuthors: [],
    presentAuthors: [],
    missingBooks: [],
    presentBooks: [],
    allDropboxBooks: [],
    authorFolderStructure: [],
  };

  for (const authorFolder of authorFolders) {
    const authorName = authorFolder.name;
    const normalizedAuthor = normalize(authorName);
    const inDb = dbAuthorMap.has(normalizedAuthor);

    if (!inDb) {
      results.missingAuthors.push(authorName);
    } else {
      results.presentAuthors.push(authorName);
    }

    // Look for Books subfolder
    const authorContents = await listFolder(token, authorFolder.path_display || authorFolder.path_lower);
    const booksSubfolder = authorContents.find(e => e['.tag'] === 'folder' && normalize(e.name) === 'books');

    if (booksSubfolder) {
      const bookItems = await listFolder(token, booksSubfolder.path_display || booksSubfolder.path_lower);

      for (const item of bookItems) {
        let bookTitle = null;

        if (item['.tag'] === 'folder') {
          // Subfolder = book title
          if (!SYSTEM_FOLDERS.has(normalize(item.name))) {
            bookTitle = item.name;
          }
        } else if (item['.tag'] === 'file') {
          // File = could be a book PDF
          if (item.name.match(/\.(pdf|epub|mobi)$/i)) {
            bookTitle = stripExt(item.name);
          }
        }

        if (bookTitle) {
          const normalizedBook = normalize(bookTitle);
          const inDbBook = dbBookTitles.has(normalizedBook);

          const entry = {
            author: authorName,
            title: bookTitle,
            path: item.path_lower,
            type: item['.tag'],
            size: item.size || null,
            inDb: inDbBook,
          };

          results.allDropboxBooks.push(entry);
          if (!inDbBook) {
            results.missingBooks.push(entry);
          } else {
            results.presentBooks.push(entry);
          }
        }
      }
    }

    // Also check Published Works subfolder
    const pubWorksSubfolder = authorContents.find(e => e['.tag'] === 'folder' && normalize(e.name) === 'published works');
    if (pubWorksSubfolder) {
      const pubItems = await listFolder(token, pubWorksSubfolder.path_display || pubWorksSubfolder.path_lower);
      for (const item of pubItems) {
        if (item['.tag'] === 'file' && item.name.match(/\.(pdf|epub|mobi)$/i)) {
          const bookTitle = stripExt(item.name);
          const normalizedBook = normalize(bookTitle);
          const inDbBook = dbBookTitles.has(normalizedBook);
          const entry = {
            author: authorName,
            title: bookTitle,
            path: item.path_lower,
            type: 'file',
            size: item.size || null,
            inDb: inDbBook,
            source: 'published_works',
          };
          results.allDropboxBooks.push(entry);
          if (!inDbBook) results.missingBooks.push(entry);
        }
      }
    }

    process.stdout.write(`  ✓ ${authorName}\n`);
  }

  await conn.end();

  // Output summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('DEEP SCAN SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Authors in Dropbox: ${authorFolders.length}`);
  console.log(`  ✅ Already in DB: ${results.presentAuthors.length}`);
  console.log(`  ❌ Missing from DB: ${results.missingAuthors.length}`);
  console.log(`\nBooks found in Dropbox: ${results.allDropboxBooks.length}`);
  console.log(`  ✅ Already in DB: ${results.presentBooks.length}`);
  console.log(`  ❌ Missing from DB: ${results.missingBooks.length}`);

  if (results.missingAuthors.length > 0) {
    console.log('\n❌ MISSING AUTHORS:');
    results.missingAuthors.forEach(a => console.log('  -', a));
  }

  if (results.missingBooks.length > 0) {
    console.log('\n❌ MISSING BOOKS (first 30):');
    results.missingBooks.slice(0, 30).forEach(b => console.log(`  - [${b.author}] ${b.title}`));
    if (results.missingBooks.length > 30) console.log(`  ... and ${results.missingBooks.length - 30} more`);
  }

  const outputPath = '/home/ubuntu/dropbox_deep_inventory.json';
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Full inventory written to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
