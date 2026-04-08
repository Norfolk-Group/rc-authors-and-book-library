/**
 * update-substack-counts.mjs
 *
 * Fetches Substack post counts for all authors with a substackUrl
 * and updates the substackPostCount column in author_profiles.
 *
 * Usage:
 *   node update-substack-counts.mjs
 */

import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

// ── DB connection ─────────────────────────────────────────────────────────────
function parseDbUrl(url) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error("Cannot parse DATABASE_URL");
  const [, user, password, host, port, database] = match;
  return { host, port: parseInt(port), user, password, database };
}

const cfg = parseDbUrl(databaseUrl);
const db = await mysql.createConnection({
  ...cfg,
  ssl: { rejectUnauthorized: true },
});
console.log("Connected to database.");

// ── Substack helpers ──────────────────────────────────────────────────────────
function extractSubstackSubdomain(substackUrl) {
  if (!substackUrl) return null;
  const match = substackUrl.match(/([a-zA-Z0-9_-]+)\.substack\.com/i);
  return match ? match[1] : null;
}

async function countSubstackPosts(subdomain) {
  const base = `https://${subdomain}.substack.com/api/v1/archive?sort=new&limit=12`;
  const headers = {
    "User-Agent": "authors-books-library/1.0",
    Accept: "application/json",
  };
  try {
    // Fetch first page to confirm existence
    const firstRes = await fetch(`${base}&offset=0`, { headers });
    if (!firstRes.ok) return 0;
    const firstPage = await firstRes.json();
    if (!Array.isArray(firstPage) || firstPage.length === 0) return 0;
    
    // Binary search for total count
    let lo = 0;
    let hi = 1200;
    let lastSuccessOffset = 0;
    
    // Quick probes
    for (const probe of [100, 300, 600, 1200]) {
      const res = await fetch(`${base}&offset=${probe}`, { headers });
      if (res.ok) {
        const page = await res.json();
        if (Array.isArray(page) && page.length > 0) {
          lastSuccessOffset = probe;
        } else {
          hi = probe;
          break;
        }
      } else {
        hi = probe;
        break;
      }
    }
    
    // Binary search between lastSuccessOffset and hi
    lo = lastSuccessOffset;
    while (lo + 12 < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const res = await fetch(`${base}&offset=${mid}`, { headers });
      if (res.ok) {
        const page = await res.json();
        if (Array.isArray(page) && page.length > 0) {
          lo = mid;
        } else {
          hi = mid;
        }
      } else {
        hi = mid;
      }
    }
    return lo + firstPage.length;
  } catch (e) {
    return 0;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [authors] = await db.query(
  "SELECT id, authorName, substackUrl FROM author_profiles WHERE substackUrl IS NOT NULL ORDER BY id"
);
console.log(`Found ${authors.length} authors with Substack URLs`);

let updated = 0, failed = 0, zero = 0;

for (const author of authors) {
  const subdomain = extractSubstackSubdomain(author.substackUrl);
  if (!subdomain) {
    console.log(`  SKIP [${author.id}] ${author.authorName}: cannot extract subdomain from ${author.substackUrl}`);
    continue;
  }
  
  try {
    const postCount = await countSubstackPosts(subdomain);
    
    // Update the substackPostCount column
    await db.query(
      "UPDATE author_profiles SET substackPostCount = ?, substackStatsEnrichedAt = NOW() WHERE id = ?",
      [postCount, author.id]
    );
    
    if (postCount === 0) {
      zero++;
      console.log(`  ZERO [${author.id}] ${author.authorName} (${subdomain}): 0 posts`);
    } else {
      updated++;
      console.log(`  OK [${author.id}] ${author.authorName} (${subdomain}): ${postCount} posts`);
    }
    
    // Small delay to be polite to Substack
    await new Promise(r => setTimeout(r, 500));
  } catch (err) {
    failed++;
    console.error(`  FAIL [${author.id}] ${author.authorName}: ${err.message}`);
  }
}

await db.end();
console.log(`\n=== SUBSTACK UPDATE COMPLETE ===`);
console.log(`Updated: ${updated} | Zero posts: ${zero} | Failed: ${failed}`);

// Verify
const [result] = await mysql.createConnection({ ...cfg, ssl: { rejectUnauthorized: true } }).then(async c => {
  const r = await c.query("SELECT COUNT(*) as total, SUM(CASE WHEN substackPostCount > 0 THEN 1 ELSE 0 END) as withPosts FROM author_profiles WHERE substackUrl IS NOT NULL");
  await c.end();
  return r;
});
console.log(`\nVerification: ${result[0].withPosts}/${result[0].total} Substack authors have post counts > 0`);
