/**
 * sync-substack-to-social-stats.mjs
 *
 * For authors who have substackPostCount set but socialStatsJson is missing
 * the substack.postCount, this script merges the data into socialStatsJson.
 */

import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

function parseDbUrl(url) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error("Cannot parse DATABASE_URL");
  const [, user, password, host, port, database] = match;
  return { host, port: parseInt(port), user, password, database };
}

const db = await mysql.createConnection({
  ...parseDbUrl(databaseUrl),
  ssl: { rejectUnauthorized: true },
});

// Get authors with substackPostCount but missing in socialStatsJson
const [authors] = await db.query(`
  SELECT id, authorName, substackUrl, substackPostCount, substackSubscriberRange, socialStatsJson
  FROM author_profiles 
  WHERE substackPostCount > 0 
    AND (socialStatsJson IS NULL OR JSON_EXTRACT(socialStatsJson, '$.substack.postCount') IS NULL)
`);

console.log(`Found ${authors.length} authors needing socialStatsJson sync`);

for (const author of authors) {
  let stats = {};
  if (author.socialStatsJson) {
    try { stats = JSON.parse(author.socialStatsJson); } catch { /* ignore */ }
  }
  
  // Merge substack data
  stats.substack = {
    ...(stats.substack || {}),
    substackUrl: author.substackUrl,
    postCount: author.substackPostCount,
    subscriberRange: author.substackSubscriberRange || null,
    fetchedAt: new Date().toISOString(),
  };
  
  await db.query(
    "UPDATE author_profiles SET socialStatsJson = ? WHERE id = ?",
    [JSON.stringify(stats), author.id]
  );
  console.log(`  Updated [${author.id}] ${author.authorName}: ${author.substackPostCount} posts`);
}

await db.end();
console.log("\nDone!");
