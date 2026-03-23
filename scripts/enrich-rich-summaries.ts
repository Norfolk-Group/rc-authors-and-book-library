/**
 * enrich-rich-summaries.ts
 * Runs the enrichRichSummary pipeline for all books missing richSummaryJson.
 * Run with: npx tsx scripts/enrich-rich-summaries.ts
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { bookProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { enrichRichSummary } from "../server/enrichment/richSummary";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allBooks = await db
    .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary, richSummaryJson: bookProfiles.richSummaryJson })
    .from(bookProfiles);

  const toProcess = allBooks.filter((b) => !b.richSummaryJson);
  console.log(`[enrich-rich-summaries] ${toProcess.length} books to process (${allBooks.length - toProcess.length} already done)`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const book = toProcess[i];
    try {
      process.stdout.write(`[${i + 1}/${toProcess.length}] "${book.bookTitle}" ... `);
      const result = await enrichRichSummary(
        book.bookTitle,
        book.authorName ?? "",
        book.summary ?? undefined,
        undefined
      );
      if (result) {
        await db
          .update(bookProfiles)
          .set({
            richSummaryJson: JSON.stringify(result),
            resourceLinksJson: JSON.stringify(result.resourceLinks),
          })
          .where(eq(bookProfiles.bookTitle, book.bookTitle));
        console.log("✓");
        succeeded++;
      } else {
        console.log("✗ (no data returned)");
        failed++;
      }
    } catch (err) {
      console.log(`✗ ERROR: ${err}`);
      failed++;
    }
    // Rate-limit delay
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  console.log(`\n[enrich-rich-summaries] Done. Succeeded: ${succeeded}, Failed: ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[enrich-rich-summaries] Fatal error:", err);
  process.exit(1);
});
