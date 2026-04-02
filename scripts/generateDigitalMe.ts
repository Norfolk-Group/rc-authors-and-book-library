/**
 * generateDigitalMe.ts
 * Run with: npx tsx scripts/generateDigitalMe.ts
 *
 * Generates Digital Me RAG profiles for 6 high-priority authors
 * using the project's own invokeLLM, storagePut, and DB helpers.
 */
import { getDb } from "../server/db";
import { authorProfiles, authorRagProfiles, bookProfiles } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { invokeLLM } from "../server/_core/llm";
import { storagePut } from "../server/storage";

const TARGET_AUTHORS = [
  "Malcolm Gladwell",
  "Daniel Kahneman",
  "Cal Newport",
  "Chris Voss",
  "Seth Godin",
  "Morgan Housel",
];

const MODEL = "claude-opus-4-5";

async function extractBookInsights(book: {
  bookTitle: string;
  summary: string | null;
  keyThemes: string | null;
}, authorName: string): Promise<string> {
  if (!book.summary && !book.keyThemes) {
    return `Book: "${book.bookTitle}" — No detailed content available.`;
  }
  const response = await invokeLLM({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `Extract the key intellectual insights from this book for use in a Digital Me persona file for ${authorName}.

Book: "${book.bookTitle}"
Summary: ${book.summary || "N/A"}
Key Themes: ${book.keyThemes || "N/A"}

Write 2-3 paragraphs covering:
1. The central argument and what makes it distinctive
2. Key frameworks or models introduced
3. How this book fits into the author's broader intellectual arc

Be specific and analytical. No filler.`,
      },
    ],
  });
  const content = response?.choices?.[0]?.message?.content;
  return typeof content === "string"
    ? `### "${book.bookTitle}"\n${content}`
    : `Book: "${book.bookTitle}" — Extraction failed.`;
}

async function synthesizeRagFile(
  author: {
    authorName: string;
    bio: string | null;
    richBioJson: string | null;
    geographyJson: string | null;
    historicalContextJson: string | null;
    familyJson: string | null;
    associationsJson: string | null;
    formativeExperiencesJson: string | null;
    authorDescriptionJson: string | null;
    businessProfileJson: string | null;
    professionalEntriesJson: string | null;
  },
  bookInsights: string[]
): Promise<string> {
  const richBio = author.richBioJson ? JSON.parse(author.richBioJson) : null;
  const geography = author.geographyJson ? JSON.parse(author.geographyJson) : null;
  const historical = author.historicalContextJson ? JSON.parse(author.historicalContextJson) : null;
  const family = author.familyJson ? JSON.parse(author.familyJson) : null;
  const associations = author.associationsJson ? JSON.parse(author.associationsJson) : null;
  const formativeExp = author.formativeExperiencesJson ? JSON.parse(author.formativeExperiencesJson) : null;
  const description = author.authorDescriptionJson ? JSON.parse(author.authorDescriptionJson) : null;
  const business = author.businessProfileJson ? JSON.parse(author.businessProfileJson) : null;
  const professionalEntries = author.professionalEntriesJson ? JSON.parse(author.professionalEntriesJson) : null;

  const contextBlock = [
    author.bio ? `BIOGRAPHY:\n${author.bio}` : "",
    richBio?.fullBio ? `RICH BIOGRAPHY:\n${richBio.fullBio}` : "",
    geography ? `GEOGRAPHY:\n${JSON.stringify(geography, null, 2)}` : "",
    historical ? `HISTORICAL CONTEXT:\n${JSON.stringify(historical, null, 2)}` : "",
    family ? `FAMILY & UPBRINGING:\n${JSON.stringify(family, null, 2)}` : "",
    associations ? `ASSOCIATIONS & NETWORKS:\n${JSON.stringify(associations, null, 2)}` : "",
    formativeExp?.length ? `FORMATIVE EXPERIENCES:\n${JSON.stringify(formativeExp, null, 2)}` : "",
    description ? `PHYSICAL PRESENCE & STYLE:\n${JSON.stringify(description, null, 2)}` : "",
    business ? `BUSINESS PROFILE:\n${JSON.stringify(business, null, 2)}` : "",
    professionalEntries?.length ? `CAREER HISTORY:\n${JSON.stringify(professionalEntries, null, 2)}` : "",
  ].filter(Boolean).join("\n\n---\n\n");

  const booksBlock = bookInsights.length > 0
    ? bookInsights.join("\n\n")
    : "No book content available.";

  const prompt = `You are building a comprehensive Digital Me persona knowledge file for ${author.authorName}.
This file will be used as a system prompt to power an AI chatbot that impersonates ${author.authorName}.
It must be rich, specific, and grounded in the actual data provided below.

AUTHOR DATA:
${contextBlock}

CONTENT CATALOG INSIGHTS:
${booksBlock}

---
Write the complete Digital Me knowledge file in the following exact Markdown structure.
Be specific, detailed, and use actual facts from the data. Do NOT use generic filler.
Aim for 1500–2500 words total.

# Digital Me: ${author.authorName}
## Generated: ${new Date().toISOString().split("T")[0]}
---
## 1. Identity & Biographical Foundation
## 2. Formative Context
## 3. Core Ideology & Worldview
## 4. Favorite Subjects & Recurring Themes
## 5. Voice, Tone & Writing Style
## 6. Signature Frameworks & Mental Models
## 7. Personality & Behavioral Traits
## 8. Physical Presence & Personal Brand
## 9. Causes, Advocacy & Values
## 10. Intellectual Influences & Associations
## 11. Signature Phrases & Rhetorical Patterns
## 12. Content Catalog Summary
## 13. Known Gaps & Contradictions

IMPORTANT: Respond only with the Markdown content. No preamble, no explanation.`;

  const response = await invokeLLM({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are a master biographer and persona architect. Write rich, specific, grounded persona knowledge files. Never use generic filler. Every sentence must be grounded in actual facts about the person.",
      },
      { role: "user", content: prompt },
    ],
  });
  const content = response?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : `# Digital Me: ${author.authorName}\n\nGeneration failed.`;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  for (const authorName of TARGET_AUTHORS) {
    console.log(`\n=== Generating Digital Me for: ${authorName} ===`);

    // Check if already generating
    const existing = await db
      .select({ ragStatus: authorRagProfiles.ragStatus, ragVersion: authorRagProfiles.ragVersion })
      .from(authorRagProfiles)
      .where(eq(authorRagProfiles.authorName, authorName))
      .limit(1);

    if (existing[0]?.ragStatus === "ready") {
      console.log(`  SKIP: Already has a ready RAG profile (v${existing[0].ragVersion})`);
      continue;
    }

    const currentVersion = existing[0]?.ragVersion ?? 0;
    const nextVersion = currentVersion + 1;

    // Mark as generating
    if (existing.length === 0) {
      await db.insert(authorRagProfiles).values({
        authorName,
        ragStatus: "generating",
        ragVersion: nextVersion,
        contentItemCount: 0,
      });
    } else {
      await db.update(authorRagProfiles)
        .set({ ragStatus: "generating", ragVersion: nextVersion, updatedAt: new Date() })
        .where(eq(authorRagProfiles.authorName, authorName));
    }

    try {
      // Get author profile
      const authorRows = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, authorName))
        .limit(1);

      if (!authorRows[0]) {
        console.log(`  SKIP: No author profile in DB`);
        continue;
      }

      const author = authorRows[0];

      // Get books
      const books = await db
        .select({
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          keyThemes: bookProfiles.keyThemes,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.authorName, authorName));

      console.log(`  Found ${books.length} books in DB`);

      // Extract book insights (cap at 10)
      const bookInsights: string[] = [];
      for (const book of books.slice(0, 10)) {
        console.log(`  Extracting insights for: ${book.bookTitle}`);
        const insight = await extractBookInsights(book, authorName);
        bookInsights.push(insight);
      }

      // Synthesize RAG file
      console.log(`  Synthesizing Digital Me profile...`);
      const ragContent = await synthesizeRagFile(author as Parameters<typeof synthesizeRagFile>[0], bookInsights);
      const wordCount = ragContent.split(/\s+/).length;

      // Upload to S3
      const s3Key = `library/${authorName.toLowerCase().replace(/\s+/g, "-")}/digital-me/rag-v${nextVersion}.md`;
      const { url: ragFileUrl } = await storagePut(
        s3Key,
        Buffer.from(ragContent, "utf-8"),
        "text/markdown"
      );

      // Get bio completeness
      const bioRow = await db
        .select({ bioCompleteness: authorProfiles.bioCompleteness })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, authorName))
        .limit(1);

      // Update DB
      await db.update(authorRagProfiles)
        .set({
          ragFileUrl,
          ragFileKey: s3Key,
          ragVersion: nextVersion,
          ragGeneratedAt: new Date(),
          ragWordCount: wordCount,
          ragModel: MODEL,
          ragVendor: "anthropic",
          contentItemCount: books.length,
          bioCompletenessAtGeneration: bioRow[0]?.bioCompleteness ?? 0,
          ragStatus: "ready",
          ragError: null,
          updatedAt: new Date(),
        })
        .where(eq(authorRagProfiles.authorName, authorName));

      console.log(`  ✅ Done: ${wordCount} words, ${books.length} books, saved to S3`);
    } catch (err) {
      console.error(`  ❌ Error:`, err);
      await db.update(authorRagProfiles)
        .set({ ragStatus: "stale", ragError: String(err), updatedAt: new Date() })
        .where(eq(authorRagProfiles.authorName, authorName));
    }
  }

  console.log("\n✅ Digital Me generation complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
