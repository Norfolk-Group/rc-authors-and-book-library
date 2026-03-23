/**
 * enrich-rich-bios.ts
 * Runs the enrichRichBio pipeline for all authors missing richBioJson.
 * Run with: npx tsx scripts/enrich-rich-bios.ts
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { authorProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { enrichRichBio } from "../server/enrichment/richBio";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allAuthors = await db
    .select({ authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson })
    .from(authorProfiles);

  const toProcess = allAuthors.filter((a) => !a.richBioJson);
  console.log(`[enrich-rich-bios] ${toProcess.length} authors to process (${allAuthors.length - toProcess.length} already done)`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const author = toProcess[i];
    try {
      process.stdout.write(`[${i + 1}/${toProcess.length}] ${author.authorName} ... `);
      const result = await enrichRichBio(author.authorName, author.bio ?? undefined, undefined);
      if (result) {
        await db
          .update(authorProfiles)
          .set({
            richBioJson: JSON.stringify(result),
            professionalEntriesJson: JSON.stringify(result.professionalEntries),
          })
          .where(eq(authorProfiles.authorName, author.authorName));
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

  console.log(`\n[enrich-rich-bios] Done. Succeeded: ${succeeded}, Failed: ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[enrich-rich-bios] Fatal error:", err);
  process.exit(1);
});
