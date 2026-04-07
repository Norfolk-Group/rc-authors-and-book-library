/**
 * scanDropboxBackup.mjs
 * Scans the Dropbox backup folder and outputs a structured inventory
 * of all authors, books, covers, avatars, and files found.
 */
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const BASE = '/Cidale Interests/01_Companies/Norfolk AI/Apps/RC Library App/Authors and Books Backup';

async function getToken() {
  // Use the Dropbox refresh token to get a fresh access token
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (!refreshToken || !appKey || !appSecret) {
    // Fall back to direct access token
    const directToken = process.env.DROPBOX_ACCESS_TOKEN;
    if (directToken) return directToken;
    throw new Error('No Dropbox credentials found');
  }

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
  if (!data.access_token) throw new Error('Failed to refresh token: ' + JSON.stringify(data));
  return data.access_token;
}

async function listFolder(token, path) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive: false, limit: 2000 }),
  });
  const data = await resp.json();
  if (data.error) {
    console.error('Dropbox error for path', path, ':', JSON.stringify(data.error));
    return [];
  }
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

function normalizeAuthorName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeBookTitle(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.(pdf|epub|mobi|mp3|mp4|m4a|docx?)$/i, '');
}

async function main() {
  console.log('🔍 Getting Dropbox token...');
  const token = await getToken();
  console.log('✅ Token obtained\n');

  // Step 1: List top-level entries (should be author folders)
  console.log(`📂 Scanning: ${BASE}`);
  const topLevel = await listFolder(token, BASE);
  console.log(`Found ${topLevel.length} top-level entries\n`);

  const authorFolders = topLevel.filter(e => e['.tag'] === 'folder');
  const topLevelFiles = topLevel.filter(e => e['.tag'] === 'file');

  console.log(`📁 Author folders: ${authorFolders.length}`);
  console.log(`📄 Top-level files: ${topLevelFiles.length}\n`);

  // Step 2: For each author folder, list its contents
  const inventory = [];
  for (const authorFolder of authorFolders) {
    const authorName = authorFolder.name;
    const authorEntry = { name: authorName, path: authorFolder.path_lower, subfolders: [], files: [], books: [] };

    const contents = await listFolder(token, authorFolder.path_display || authorFolder.path_lower);
    const subfolders = contents.filter(e => e['.tag'] === 'folder');
    const files = contents.filter(e => e['.tag'] === 'file');

    authorEntry.files = files.map(f => ({ name: f.name, size: f.size, modified: f.server_modified }));

    for (const sub of subfolders) {
      const subName = sub.name;
      authorEntry.subfolders.push(subName);

      // Scan one level deeper for book files
      const subContents = await listFolder(token, sub.path_display || sub.path_lower);
      for (const item of subContents) {
        if (item['.tag'] === 'file') {
          authorEntry.books.push({
            folder: subName,
            name: item.name,
            size: item.size,
            modified: item.server_modified,
            path: item.path_lower,
          });
        }
      }
    }

    inventory.push(authorEntry);
    process.stdout.write(`  ✓ ${authorName} (${subfolders.length} subfolders, ${files.length} files)\n`);
  }

  // Step 3: Connect to DB and compare
  console.log('\n🗄️  Connecting to database...');
  const conn = await createConnection(process.env.DATABASE_URL);

  const [dbAuthors] = await conn.execute('SELECT id, authorName FROM author_profiles');
  const [dbBooks] = await conn.execute('SELECT id, bookTitle, authorName FROM book_profiles');

  const dbAuthorNames = new Set(dbAuthors.map(a => normalizeAuthorName(a.authorName)));
  const dbBookTitles = new Set(dbBooks.map(b => normalizeBookTitle(b.bookTitle)));

  console.log(`\n📊 Database: ${dbAuthors.length} authors, ${dbBooks.length} books\n`);

  // Step 4: Find missing authors and books
  const missingAuthors = [];
  const missingBooks = [];
  const presentAuthors = [];

  for (const author of inventory) {
    const normalized = normalizeAuthorName(author.name);
    const inDb = dbAuthorNames.has(normalized);

    if (!inDb) {
      missingAuthors.push(author.name);
    } else {
      presentAuthors.push(author.name);
    }

    // Check books (subfolders are book titles)
    for (const subfolder of author.subfolders) {
      const normalizedBook = normalizeBookTitle(subfolder);
      if (!dbBookTitles.has(normalizedBook)) {
        missingBooks.push({ author: author.name, book: subfolder, inDb: false });
      }
    }
    // Also check files at author level (could be book PDFs)
    for (const file of author.files) {
      if (file.name.match(/\.(pdf|epub|mobi)$/i)) {
        const normalizedBook = normalizeBookTitle(file.name);
        if (!dbBookTitles.has(normalizedBook)) {
          missingBooks.push({ author: author.name, book: file.name, inDb: false, isFile: true });
        }
      }
    }
  }

  await conn.end();

  // Step 5: Output summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('DROPBOX BACKUP INVENTORY SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total authors in Dropbox backup: ${inventory.length}`);
  console.log(`Authors already in DB: ${presentAuthors.length}`);
  console.log(`Authors MISSING from DB: ${missingAuthors.length}`);
  console.log(`Books/subfolders MISSING from DB: ${missingBooks.length}`);
  console.log('');

  if (missingAuthors.length > 0) {
    console.log('MISSING AUTHORS:');
    missingAuthors.forEach(a => console.log('  ❌', a));
    console.log('');
  }

  if (missingBooks.length > 0) {
    console.log('MISSING BOOKS (sample, first 50):');
    missingBooks.slice(0, 50).forEach(b => console.log(`  ❌ [${b.author}] ${b.book}`));
    if (missingBooks.length > 50) console.log(`  ... and ${missingBooks.length - 50} more`);
    console.log('');
  }

  // Write full inventory to file for processing
  const outputPath = '/home/ubuntu/dropbox_backup_inventory.json';
  const output = {
    scannedAt: new Date().toISOString(),
    totalAuthors: inventory.length,
    missingAuthors,
    presentAuthors,
    missingBooks,
    inventory: inventory.map(a => ({
      name: a.name,
      subfolders: a.subfolders,
      fileCount: a.files.length,
      bookFileCount: a.books.length,
    })),
  };
  import('fs').then(fs => {
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n📝 Full inventory written to: ${outputPath}`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
