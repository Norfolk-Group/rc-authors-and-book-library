/**
 * reindex_neon.mjs
 *
 * Batch re-indexing script for Neon pgvector.
 * Accepts --type (authors|books|articles) and --offset/--limit for chunked runs.
 *
 * Usage:
 *   npx tsx scripts/reindex_neon.mjs --type authors --offset 0 --limit 50
 *   npx tsx scripts/reindex_neon.mjs --type books --offset 0 --limit 50
 *   npx tsx scripts/reindex_neon.mjs --type articles --offset 0 --limit 50
 */

import "dotenv/config";

const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : defaultVal;
};

const TYPE = getArg("type", "authors");
const OFFSET = parseInt(getArg("offset", "0"), 10);
const LIMIT = parseInt(getArg("limit", "50"), 10);

async function main() {
  console.log(`=== Neon Re-index: ${TYPE} offset=${OFFSET} limit=${LIMIT} ===`);

  const { getDb } = await import("../server/db.ts");
  const { indexAuthor, indexBook, indexArticle, ensureIndex } = await import(
    "../server/services/ragPipeline.service.ts"
  );

  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  await ensureIndex();

  let indexed = 0, skipped = 0, vectors = 0;

  if (TYPE === "authors") {
    const { authorProfiles } = await import("../drizzle/schema.ts");
    const rows = await db
      .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson })
      .from(authorProfiles)
      .offset(OFFSET)
      .limit(LIMIT);

    for (const a of rows) {
      let bio = a.bio ?? "";
      try {
        if (a.richBioJson) {
          const r = typeof a.richBioJson === "string" ? JSON.parse(a.richBioJson) : a.richBioJson;
          const rb = r?.fullBio ?? r?.bio ?? "";
          if (rb.length > bio.length) bio = rb;
        }
      } catch {}
      if (bio.length < 50) { skipped++; continue; }
      try {
        const v = await indexAuthor({ authorId: String(a.id), authorName: a.authorName, bioText: bio });
        vectors += v; indexed++;
        console.log(`  ✓ ${a.authorName} (${v} vectors)`);
      } catch (e) {
        skipped++;
        console.warn(`  ✗ ${a.authorName}: ${e.message}`);
      }
    }

  } else if (TYPE === "books") {
    const { bookProfiles } = await import("../drizzle/schema.ts");
    const rows = await db
      .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary, richSummaryJson: bookProfiles.richSummaryJson })
      .from(bookProfiles)
      .offset(OFFSET)
      .limit(LIMIT);

    for (const b of rows) {
      let text = b.summary ?? "";
      try {
        if (b.richSummaryJson) {
          const r = typeof b.richSummaryJson === "string" ? JSON.parse(b.richSummaryJson) : b.richSummaryJson;
          if (r?.fullSummary && r.fullSummary.length > text.length) text = r.fullSummary;
          if (r?.summary && r.summary.length > text.length) text = r.summary;
        }
      } catch {}
      if (text.length < 50) { skipped++; continue; }
      try {
        const v = await indexBook({ bookId: String(b.id), title: b.bookTitle, authorName: b.authorName ?? undefined, text });
        vectors += v; indexed++;
        console.log(`  ✓ ${b.bookTitle} (${v} vectors)`);
      } catch (e) {
        skipped++;
        console.warn(`  ✗ ${b.bookTitle}: ${e.message}`);
      }
    }

  } else if (TYPE === "articles") {
    const { magazineArticles } = await import("../drizzle/schema.ts");
    const rows = await db
      .select({ id: magazineArticles.id, title: magazineArticles.title, authorName: magazineArticles.authorName, summaryText: magazineArticles.summaryText, fullText: magazineArticles.fullText, publication: magazineArticles.publication })
      .from(magazineArticles)
      .offset(OFFSET)
      .limit(LIMIT);

    for (const a of rows) {
      const text = a.fullText ?? a.summaryText ?? a.title ?? "";
      if (text.length < 50) { skipped++; continue; }
      try {
        const v = await indexArticle({ articleId: String(a.id), title: a.title, authorName: a.authorName ?? undefined, text, publication: a.publication ?? undefined });
        vectors += v; indexed++;
        console.log(`  ✓ ${a.title?.slice(0, 60)} (${v} vectors)`);
      } catch (e) {
        skipped++;
        console.warn(`  ✗ ${a.title?.slice(0, 60)}: ${e.message}`);
      }
    }
  }

  console.log(`\nDone: ${indexed} indexed, ${skipped} skipped, ${vectors} vectors`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
