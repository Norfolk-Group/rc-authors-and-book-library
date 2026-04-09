#!/usr/bin/env node
/**
 * Batch Auto-Tag Script
 * Sends all untagged authors to Gemini in batches of 30 using JSON schema output.
 * Much faster than 169 individual API calls.
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!DB_URL) throw new Error("DATABASE_URL not set");
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

const TAXONOMY = [
  "Business", "Psychology", "Science", "Leadership", "Economics",
  "Technology", "Philosophy", "History", "Health", "Communication",
  "Productivity", "Finance", "Politics", "Sociology", "Education"
];

const conn = await mysql.createConnection(DB_URL);

// Fetch all untagged authors with their bios
const [untagged] = await conn.execute(
  `SELECT id, authorName, bio, richBioJson 
   FROM author_profiles 
   WHERE (tagsJson IS NULL OR tagsJson = '[]' OR tagsJson = '' OR JSON_LENGTH(tagsJson) = 0)
   ORDER BY authorName`
);

console.log(`Untagged authors to process: ${untagged.length}`);

// Build author list with bio snippets
const authorList = untagged.map(a => {
  let bio = a.bio || "";
  if (a.richBioJson) {
    try {
      const rich = JSON.parse(a.richBioJson);
      if (rich.fullBio) bio = rich.fullBio;
      else if (rich.summary) bio = rich.summary;
    } catch {}
  }
  return {
    id: a.id,
    name: a.authorName,
    bio: bio.substring(0, 200)
  };
});

// Process in batches of 30
const BATCH_SIZE = 15;
let totalTagged = 0;
let totalSkipped = 0;

for (let i = 0; i < authorList.length; i += BATCH_SIZE) {
  const batch = authorList.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(authorList.length / BATCH_SIZE);
  
  console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} authors)...`);

  const authorLines = batch.map((a, idx) => 
    `${idx + 1}. ${a.name}: ${a.bio || "(no bio)"}`
  ).join("\n");

  const prompt = `You are a librarian categorizing authors. For each author below, assign 2-4 tags from this taxonomy ONLY: ${TAXONOMY.join(", ")}.

Authors:
${authorLines}

Respond with a JSON array where each element has "name" (exact author name) and "tags" (array of 2-4 taxonomy strings).
Example: [{"name": "Adam Grant", "tags": ["Psychology", "Business"]}, ...]
Only use tags from the taxonomy. Respond with ONLY the JSON array, no other text.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
            temperature: 0.1, 
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`  API error ${response.status}:`, errText.substring(0, 200));
      totalSkipped += batch.length;
      continue;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!text) {
      console.error("  Empty response from Gemini");
      totalSkipped += batch.length;
      continue;
    }

    let results;
    try {
      // Try full parse first
      const fullMatch = text.match(/\[[\s\S]*\]/);
      if (fullMatch) {
        try {
          results = JSON.parse(fullMatch[0]);
        } catch {
          // Full parse failed (truncated) — extract individual complete objects
          const objMatches = text.matchAll(/\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"tags"\s*:\s*(\[[\s\S]*?\])\s*\}/g);
          results = [];
          for (const m of objMatches) {
            try {
              results.push({ name: m[1], tags: JSON.parse(m[2]) });
            } catch {}
          }
          if (results.length === 0) throw new Error("No parseable objects found");
          console.log(`  (partial parse: recovered ${results.length} objects from truncated response)`);
        }
      } else {
        throw new Error("No JSON array found in response");
      }
    } catch (parseErr) {
      console.error("  JSON parse error:", parseErr.message);
      console.error("  Raw response:", text.substring(0, 300));
      totalSkipped += batch.length;
      continue;
    }

    // Apply tags to each author
    let batchTagged = 0;
    for (const result of results) {
      if (!result.name || !Array.isArray(result.tags)) continue;
      
      // Find the author by name
      const author = batch.find(a => a.name === result.name);
      if (!author) continue;

      // Validate tags are from taxonomy
      const validTags = result.tags.filter(t => TAXONOMY.includes(t)).slice(0, 4);
      if (validTags.length === 0) continue;

      // Update author's tagsJson
      await conn.execute(
        "UPDATE author_profiles SET tagsJson = ? WHERE id = ?",
        [JSON.stringify(validTags), author.id]
      );

      // Ensure tags exist in the tags table
      for (const tagName of validTags) {
        await conn.execute(
          "INSERT IGNORE INTO tags (name, slug, color) VALUES (?, ?, ?)",
          [tagName, tagName.toLowerCase().replace(/\s+/g, "-"), "#6366f1"]
        );
      }

      batchTagged++;
    }

    totalTagged += batchTagged;
    totalSkipped += (batch.length - batchTagged);
    console.log(`  ✓ Tagged ${batchTagged}/${batch.length} in this batch`);

    // Small delay between batches
    if (i + BATCH_SIZE < authorList.length) {
      await new Promise(r => setTimeout(r, 1000));
    }

  } catch (err) {
    console.error(`  Batch error:`, err.message);
    totalSkipped += batch.length;
  }
}

// Final verification
console.log("\n=== FINAL VERIFICATION ===");
const [tagStats] = await conn.execute(
  `SELECT 
     COUNT(*) as total,
     SUM(CASE WHEN tagsJson IS NOT NULL AND tagsJson != '[]' AND tagsJson != '' AND JSON_LENGTH(tagsJson) > 0 THEN 1 ELSE 0 END) as tagged,
     SUM(CASE WHEN tagsJson IS NULL OR tagsJson = '[]' OR tagsJson = '' OR JSON_LENGTH(tagsJson) = 0 THEN 1 ELSE 0 END) as untagged
   FROM author_profiles`
);
const [tagTableStats] = await conn.execute("SELECT COUNT(*) as count FROM tags");

const ts = tagStats[0];
const tagPct = ((ts.tagged / ts.total) * 100).toFixed(1);
console.log(`Tagged: ${ts.tagged}/${ts.total} (${tagPct}%)`);
console.log(`Untagged: ${ts.untagged}`);
console.log(`Unique tags in tags table: ${tagTableStats[0].count}`);
console.log(`\nThis run: tagged ${totalTagged}, skipped ${totalSkipped}`);

await conn.end();
console.log("\n✅ Batch auto-tagging complete!");
