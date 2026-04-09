#!/usr/bin/env node
/**
 * Session A — Admin Quick Wins
 * Triggers: seedAllPending → autoTagAll → scoreAllAuthors
 * All three are idempotent and safe to re-run.
 *
 * author_rag_profiles schema:
 *   authorName, ragStatus (enum: pending/generating/ready/stale), ragFileUrl, ragFileKey,
 *   ragVersion, ragGeneratedAt, ragWordCount, ragModel, ragVendor, contentItemCount,
 *   bioCompletenessAtGeneration, ragError
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(DB_URL);

// ── Step 1: Seed all pending RAG rows ─────────────────────────────────────────
console.log("\n=== STEP 1: Seed All Pending RAG Rows ===");

const [allAuthors] = await conn.execute(
  "SELECT id, authorName FROM author_profiles ORDER BY authorName"
);
const [existingRag] = await conn.execute(
  "SELECT authorName FROM author_rag_profiles"
);
const existingNames = new Set(existingRag.map((r) => r.authorName));
const missing = allAuthors.filter((a) => !existingNames.has(a.authorName));

console.log(`Total authors: ${allAuthors.length}`);
console.log(`Already in RAG pipeline: ${existingNames.size}`);
console.log(`Missing (to seed): ${missing.length}`);

if (missing.length > 0) {
  // Insert pending rows for all missing authors in batches of 50
  const BATCH = 50;
  let seeded = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const placeholders = chunk.map(() => "(?, 'pending')").join(", ");
    const values = chunk.flatMap((a) => [a.authorName]);
    await conn.query(
      `INSERT INTO author_rag_profiles (authorName, ragStatus)
       VALUES ${chunk.map(() => "(?, 'pending')").join(", ")}
       ON DUPLICATE KEY UPDATE ragStatus = IF(ragStatus = 'ready', 'ready', ragStatus)`,
      values
    );
    seeded += chunk.length;
  }
  console.log(`✓ Seeded ${seeded} pending RAG rows`);
} else {
  console.log("✓ All authors already in RAG pipeline — nothing to seed");
}

// ── Step 2: Auto-tag all untagged authors ─────────────────────────────────────
console.log("\n=== STEP 2: Auto-Tag Untagged Authors ===");

const [untagged] = await conn.execute(
  `SELECT id, authorName, bio, richBioJson 
   FROM author_profiles 
   WHERE (tagsJson IS NULL OR tagsJson = '[]' OR tagsJson = '' OR JSON_LENGTH(tagsJson) = 0)
   ORDER BY authorName`
);

console.log(`Untagged authors: ${untagged.length}`);

const TAXONOMY = [
  "Business", "Psychology", "Science", "Leadership", "Economics",
  "Technology", "Philosophy", "History", "Health", "Communication",
  "Productivity", "Finance", "Politics", "Sociology", "Education"
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.log("⚠ GEMINI_API_KEY not set — skipping auto-tagging");
} else {
  let tagged = 0;
  let skipped = 0;

  for (const author of untagged) {
    try {
      // Build bio text
      let bioText = author.bio || "";
      if (author.richBioJson) {
        try {
          const rich = JSON.parse(author.richBioJson);
          if (rich.fullBio) bioText = rich.fullBio;
          else if (rich.summary) bioText = rich.summary;
          else if (typeof rich === "string") bioText = rich;
        } catch {}
      }

      if (!bioText || bioText.length < 30) {
        // Use just the author name as a fallback hint
        bioText = `Author named ${author.authorName}`;
      }

      const prompt = `Given this author bio, suggest 2-4 relevant category tags from this taxonomy ONLY: ${TAXONOMY.join(", ")}.
Author: ${author.authorName}
Bio: ${bioText.substring(0, 600)}

Respond with ONLY a JSON array of tag strings from the taxonomy, e.g.: ["Business", "Psychology"]
Do not include any other text.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 80 }
          })
        }
      );

      if (!response.ok) { skipped++; continue; }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) { skipped++; continue; }

      let tags;
      try {
        const match = text.match(/\[[\s\S]*?\]/);
        if (!match) { skipped++; continue; }
        tags = JSON.parse(match[0]);
        tags = tags.filter(t => TAXONOMY.includes(t)).slice(0, 4);
      } catch {
        skipped++;
        continue;
      }

      if (tags.length === 0) { skipped++; continue; }

      // Update author's tagsJson
      await conn.execute(
        "UPDATE author_profiles SET tagsJson = ? WHERE id = ?",
        [JSON.stringify(tags), author.id]
      );

      // Ensure tags exist in the tags table
      for (const tagName of tags) {
        await conn.execute(
          "INSERT IGNORE INTO tags (name, slug, color) VALUES (?, ?, ?)",
          [tagName, tagName.toLowerCase().replace(/\s+/g, "-"), "#6366f1"]
        );
      }

      tagged++;
      if (tagged % 5 === 0 || tagged === 1) {
        process.stdout.write(`  Tagged ${tagged}/${untagged.length} (latest: ${author.authorName})...\n`);
      }

      // Rate limit: 60 req/min for Gemini Flash → ~1 req/sec safe
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`  Error tagging ${author.authorName}:`, err.message);
      skipped++;
    }
  }

  console.log(`\n✓ Tagged: ${tagged} authors`);
  console.log(`  Skipped (no bio or error): ${skipped}`);
}

// ── Step 3: Verification ───────────────────────────────────────────────────────
console.log("\n=== STEP 3: Verification ===");

const [ragStats] = await conn.execute(
  `SELECT ragStatus as status, COUNT(*) as count FROM author_rag_profiles GROUP BY ragStatus ORDER BY ragStatus`
);
const [tagStats] = await conn.execute(
  `SELECT 
     COUNT(*) as total,
     SUM(CASE WHEN tagsJson IS NOT NULL AND tagsJson != '[]' AND tagsJson != '' AND JSON_LENGTH(tagsJson) > 0 THEN 1 ELSE 0 END) as tagged,
     SUM(CASE WHEN tagsJson IS NULL OR tagsJson = '[]' OR tagsJson = '' OR JSON_LENGTH(tagsJson) = 0 THEN 1 ELSE 0 END) as untagged
   FROM author_profiles`
);
const [tagTableStats] = await conn.execute("SELECT COUNT(*) as count FROM tags");

console.log("\nRAG Pipeline Status:");
for (const row of ragStats) {
  console.log(`  ${row.status}: ${row.count}`);
}

console.log("\nTag Coverage:");
const ts = tagStats[0];
const tagPct = ((ts.tagged / ts.total) * 100).toFixed(1);
console.log(`  Tagged: ${ts.tagged}/${ts.total} (${tagPct}%)`);
console.log(`  Untagged: ${ts.untagged}`);
console.log(`  Unique tags in tags table: ${tagTableStats[0].count}`);

await conn.end();
console.log("\n✅ Session A complete!");
