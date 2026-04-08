const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
const appKey = process.env.DROPBOX_APP_KEY;
const appSecret = process.env.DROPBOX_APP_SECRET;

async function refreshAccessToken() {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: appKey, client_secret: appSecret })
  });
  return (await res.json()).access_token;
}

async function listFolder(token, path) {
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive: false })
  });
  return res.json();
}

async function checkPath(token, path) {
  const res = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  return res.json();
}

const token = await refreshAccessToken();
console.log('Token refreshed OK\n');

// List /Apps NAI
console.log('=== /Apps NAI ===');
const appsNai = await listFolder(token, '/Apps NAI');
appsNai.entries?.forEach(e => console.log(' ', e['.tag'], e.path_display));

// Check the full path from local PC
const candidates = [
  '/Apps NAI/RC Library App Data',
  '/Apps NAI/RC Library App Data/Authors and Books Backup',
  '/Apps NAI/RC Library App Data/Authors and Books Backup/Authors',
  '/Apps NAI/RC Library App Data/Inbox',
  '/Apps NAI/RC Library App Data/backup',
];

console.log('\nChecking full paths:');
for (const p of candidates) {
  const r = await checkPath(token, p);
  if (r['.tag'] === 'folder') {
    console.log('  EXISTS (folder):', r.path_display);
    const contents = await listFolder(token, p);
    contents.entries?.slice(0, 8).forEach(e => console.log('    -', e['.tag'], e.path_display));
    if ((contents.entries?.length ?? 0) > 8) {
      console.log('    ... +' + (contents.entries.length - 8) + ' more');
    }
  } else if (r['.tag'] === 'file') {
    console.log('  EXISTS (file):', r.path_display);
  } else {
    console.log('  NOT FOUND:', p, '->', r.error?.['.tag'] ?? JSON.stringify(r.error));
  }
}

// Also show what the current env vars point to
console.log('\n=== Current env var paths ===');
console.log('DROPBOX_BACKUP_FOLDER:', process.env.DROPBOX_BACKUP_FOLDER);
console.log('DROPBOX_INBOX_FOLDER:', process.env.DROPBOX_INBOX_FOLDER);

// Check /Authors_and_Books structure for comparison
console.log('\n=== /Authors_and_Books top-level ===');
const ab = await listFolder(token, '/Authors_and_Books');
ab.entries?.forEach(e => console.log(' ', e['.tag'], e.path_display));
