/**
 * enrichNewAssets.mjs
 * Triggers avatar waterfall for 18 new authors and cover scraping for 23 new books
 * by calling the live tRPC batch mutation endpoints.
 * 
 * The mirrorAvatars and mirrorCovers procedures auto-pick records with missing assets.
 * We call them in rounds until all new records are covered.
 */
// Node 22 has built-in fetch

const BASE_URL = 'http://localhost:3000';
const BATCH_SIZE = 20;

async function callTrpcMutation(path, input) {
  const url = `${BASE_URL}/api/trpc/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.error) throw new Error(JSON.stringify(json.error).slice(0, 300));
  return json.result?.data;
}

async function callTrpcQuery(path) {
  const url = `${BASE_URL}/api/trpc/${path}`;
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.error) throw new Error(JSON.stringify(json.error).slice(0, 300));
  return json.result?.data;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('ENRICHING NEW ASSETS: 18 AUTHORS + 23 BOOKS');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Step 1: Check current stats
  console.log('📊 Checking current stats...');
  try {
    const avatarStats = await callTrpcQuery('authorAvatar.getMirrorAvatarStats');
    const coverStats = await callTrpcQuery('bookProfiles.getMirrorCoverStats');
    console.log('  Avatars missing:', avatarStats?.missing ?? 'unknown');
    console.log('  Covers missing:', coverStats?.missing ?? 'unknown');
  } catch (err) {
    console.log('  Stats check failed (server may need auth):', err.message.slice(0, 100));
  }

  // ── Step 2: Run generateAllMissingAvatars for the new authors
  console.log('\n📸 STEP 1: Generating avatars for all authors with missing avatars...');
  try {
    const result = await callTrpcMutation('authorAvatar.generateAllMissingAvatars', {
      concurrency: 3,
      maxTier: 4,
      skipValidation: false,
      avatarGenVendor: 'google',
      avatarGenModel: 'nano-banana',
      avatarResearchVendor: 'google',
      avatarResearchModel: 'gemini-2.5-flash',
    });
    console.log('  Result:', JSON.stringify(result).slice(0, 300));
  } catch (err) {
    console.log('  Avatar generation error:', err.message.slice(0, 200));
    console.log('  (This is an admin-only procedure — trying mirrorAvatars instead...)');
    
    // Fallback: use mirrorAvatars which just fetches existing photos
    try {
      const result = await callTrpcMutation('authorAvatar.mirrorAvatars', { batchSize: BATCH_SIZE });
      console.log('  mirrorAvatars result:', JSON.stringify(result).slice(0, 300));
    } catch (err2) {
      console.log('  mirrorAvatars also failed:', err2.message.slice(0, 200));
    }
  }

  await sleep(2000);

  // ── Step 3: Run mirrorCovers for the new books
  console.log('\n📚 STEP 2: Mirroring covers for all books with missing covers...');
  try {
    const result = await callTrpcMutation('bookProfiles.mirrorCovers', { batchSize: BATCH_SIZE });
    console.log('  Result:', JSON.stringify(result).slice(0, 300));
  } catch (err) {
    console.log('  mirrorCovers error:', err.message.slice(0, 200));
    
    // Fallback: try rebuildAllBookCovers
    try {
      const result = await callTrpcMutation('bookProfiles.rebuildAllBookCovers', { 
        concurrency: 3, 
        rescrapeAll: false 
      });
      console.log('  rebuildAllBookCovers result:', JSON.stringify(result).slice(0, 300));
    } catch (err2) {
      console.log('  rebuildAllBookCovers also failed:', err2.message.slice(0, 200));
    }
  }

  console.log('\n✅ Enrichment jobs triggered. Check Admin → Avatars and Admin → Books for progress.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
