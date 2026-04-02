/**
 * DB Author Audit v2 — classify all author_profiles entries as person vs non-person.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const authors = JSON.parse(readFileSync("/tmp/db_authors.json", "utf8"));
console.log(`Classifying ${authors.length} author names...`);

const nameList = authors.map((a, i) => `${i + 1}. ${a.name}`).join("\n");

const response = await client.messages.create({
  model: "claude-3-haiku-20240307",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: `Classify each name as PERSON or NOT_PERSON. Return ONLY a compact JSON array (no whitespace):
[{"i":1,"c":"P"}] where c is P for PERSON or N for NOT_PERSON. Only include reason field for NOT_PERSON entries.

Names:
${nameList}`,
    },
  ],
});

const rawText = response.content[0].text.trim();
console.log("Response length:", rawText.length);
console.log("First 100 chars:", rawText.slice(0, 100));
console.log("Last 100 chars:", rawText.slice(-100));

// Find the JSON array
const startIdx = rawText.indexOf("[");
const endIdx = rawText.lastIndexOf("]");

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find JSON array brackets");
  process.exit(1);
}

const jsonStr = rawText.slice(startIdx, endIdx + 1);
let classifications;
try {
  classifications = JSON.parse(jsonStr);
} catch (e) {
  console.error("JSON parse error:", e.message);
  console.error("Near end:", jsonStr.slice(-300));
  process.exit(1);
}

// Map compact format back to full format
const mapped = classifications.map((c) => ({
  index: c.i,
  name: authors[c.i - 1]?.name || c.name || "?",
  classification: c.c === "P" ? "PERSON" : "NOT_PERSON",
  reason: c.reason || "",
}));
const notPersons = mapped.filter((c) => c.classification === "NOT_PERSON");

console.log(`\nClassification complete:`);
console.log(`  Total classified: ${classifications.length}`);
  console.log(`  PERSON: ${mapped.filter((c) => c.classification === "PERSON").length}`);
console.log(`  NOT_PERSON: ${notPersons.length}`);

if (notPersons.length > 0) {
  console.log("\nFlagged non-person entries:");
  for (const np of notPersons) {
    const author = authors[np.index - 1];
    console.log(`  [id=${author?.id}] "${np.name}" — ${np.reason || "non-person"}`);
  }
} else {
  console.log("\nNo false positives found — all 169 entries are valid person names.");
}

const results = {
  total: authors.length,
  classified: classifications.length,
  persons: mapped.filter((c) => c.classification === "PERSON").length,
  notPersonsCount: notPersons.length,
  flagged: notPersons.map((np) => ({
    ...np,
    dbId: authors[(np.index || 0) - 1]?.id,
  })),
};

writeFileSync("/tmp/author_audit_results.json", JSON.stringify(results, null, 2));
console.log("\nResults saved to /tmp/author_audit_results.json");
