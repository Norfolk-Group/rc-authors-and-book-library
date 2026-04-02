/**
 * DB Author Audit — classify all author_profiles entries as person vs non-person.
 * Uses Claude claude-3-5-haiku-20241022 (fast + cheap) for bulk classification.
 * Outputs: /tmp/author_audit_results.json
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const authors = JSON.parse(readFileSync("/tmp/db_authors.json", "utf8"));
console.log(`Classifying ${authors.length} author names...`);

// Batch all names into a single Claude call for efficiency
const nameList = authors.map((a, i) => `${i + 1}. ${a.name}`).join("\n");

const response = await client.messages.create({
  model: "claude-3-haiku-20240307",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: `You are a data quality auditor for a library database. 
      
Below is a numbered list of entries from an "author_profiles" database table.
Your task: classify each entry as either PERSON (a real human author) or NOT_PERSON (a book title, topic, organization, or other non-person entity that was incorrectly added as an author).

Rules:
- PERSON: Any real human being, even if the name includes a subtitle like "- Expert in X" or "- Author of Y"
- NOT_PERSON: Book titles, topic names (e.g. "Active Listening"), organization names, generic phrases
- When in doubt, lean toward PERSON (false negatives are less harmful than false positives)

Return ONLY a JSON array with this exact format:
[{"index": 1, "name": "...", "classification": "PERSON", "reason": "brief reason if NOT_PERSON"}]

Author list:
${nameList}`,
    },
  ],
});

const rawText = response.content[0].text.trim();
// Extract JSON from the response — strip any preamble text before the array
let classifications;
const jsonMatch = rawText.match(/\[[\s\S]*\]/);
if (!jsonMatch) {
  console.error("Could not extract JSON from response:", rawText.slice(0, 500));
  process.exit(1);
}
try {
  classifications = JSON.parse(jsonMatch[0]);
} catch (e) {
  console.error("JSON parse error:", e.message);
  console.error("Raw match:", jsonMatch[0].slice(0, 500));
  process.exit(1);
}
const notPersons = classifications.filter((c) => c.classification === "NOT_PERSON");

console.log(`\nClassification complete:`);
console.log(`  PERSON: ${classifications.filter(c => c.classification === "PERSON").length}`);
console.log(`  NOT_PERSON: ${notPersons.length}`);

if (notPersons.length > 0) {
  console.log("\nFlagged non-person entries:");
  for (const np of notPersons) {
    const author = authors[np.index - 1];
    console.log(`  [id=${author?.id}] "${np.name}" — ${np.reason || "non-person"}`);
  }
}

// Save full results
const results = {
  total: authors.length,
  persons: classifications.filter(c => c.classification === "PERSON").length,
  notPersons: notPersons.length,
  flagged: notPersons.map(np => ({
    ...np,
    dbId: authors[np.index - 1]?.id,
  })),
  all: classifications,
};

writeFileSync("/tmp/author_audit_results.json", JSON.stringify(results, null, 2));
console.log("\nFull results saved to /tmp/author_audit_results.json");
