/**
 * fix-substack-urls.mjs
 *
 * Fixes 12 authors with incorrect substackUrl values in the database.
 * Run: node scripts/fix-substack-urls.mjs
 *
 * Corrections:
 *   - Ben Horowitz: a16z newsletter post → benhorowitz.substack.com
 *   - Dan Harris: personal website → danharris.substack.com
 *   - Ezra Klein: profile page → substack.com/@ezraklein1 (he uses Substack Notes, no newsletter)
 *   - James Clear: personal website → no Substack (uses own newsletter at jamesclear.com)
 *   - Ryan Holiday: personal website → substack.com/@ryanholiday (no dedicated newsletter)
 *   - Scott Galloway: personal website → profgmedia.com (his actual Substack)
 *   - Sean Ellis: profile page → substack.com/@seanellis (no newsletter found)
 *   - Seth Godin: personal blog → no Substack (uses seths.blog)
 *   - Shankar Vedantam: Hidden Brain newsletter → news.hiddenbrain.org (already correct! it IS on Substack)
 *   - Tali Sharot: Annie Duke's post → no personal Substack found
 *   - Tim Ferriss: personal website → no Substack (uses tim.blog)
 *   - Todd Herman: profile page → thetoddhermanshow.substack.com
 */

import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Corrections: null means "remove the incorrect URL" (no Substack found)
const corrections = [
  {
    authorName: "Ben Horowitz",
    oldUrl: "https://www.a16z.news/p/we-raised-15b-why",
    newUrl: "https://benhorowitz.substack.com",
    note: "His own Substack (103 subscribers) — a16z.news is the firm's newsletter, not his personal one",
  },
  {
    authorName: "Dan Harris",
    oldUrl: "https://www.danharris.com",
    newUrl: "https://danharris.substack.com",
    note: "10% Happier Substack newsletter",
  },
  {
    authorName: "Ezra Klein",
    oldUrl: "https://substack.com/@ezraklein1",
    newUrl: "https://substack.com/@ezraklein1",
    note: "Already correct — this is his Substack profile (61K+ subscribers). Keep as-is.",
    skip: true,
  },
  {
    authorName: "James Clear",
    oldUrl: "https://jamesclear.com/newsletter",
    newUrl: null,
    note: "James Clear uses his own email platform (jamesclear.com), not Substack. Remove URL.",
  },
  {
    authorName: "Ryan Holiday",
    oldUrl: "https://ryanholiday.net",
    newUrl: null,
    note: "Ryan Holiday uses ryanholiday.net for his reading list newsletter, not Substack. Remove URL.",
  },
  {
    authorName: "Scott Galloway",
    oldUrl: "https://www.profgalloway.com",
    newUrl: "https://www.profgmedia.com",
    note: "Prof G Media Substack — his actual newsletter platform",
  },
  {
    authorName: "Sean Ellis",
    oldUrl: "https://substack.com/@seanellis",
    newUrl: "https://substack.com/@seanellis",
    note: "Already a valid Substack profile URL. Keep as-is.",
    skip: true,
  },
  {
    authorName: "Seth Godin",
    oldUrl: "https://seths.blog",
    newUrl: null,
    note: "Seth Godin uses seths.blog, not Substack. Remove URL.",
  },
  {
    authorName: "Shankar Vedantam",
    oldUrl: "https://news.hiddenbrain.org",
    newUrl: "https://news.hiddenbrain.org",
    note: "news.hiddenbrain.org IS on Substack (62K+ subscribers). Already correct.",
    skip: true,
  },
  {
    authorName: "Tali Sharot",
    oldUrl: "https://annieduke.substack.com/p/the-neuroscience-of-optimism-with",
    newUrl: null,
    note: "This was Annie Duke's post about Tali Sharot. Tali has no personal Substack. Remove URL.",
  },
  {
    authorName: "Tim Ferriss",
    oldUrl: "https://tim.blog/newsletter",
    newUrl: null,
    note: "Tim Ferriss uses tim.blog for his 5-Bullet Friday newsletter, not Substack. Remove URL.",
  },
  {
    authorName: "Todd Herman",
    oldUrl: "https://substack.com/profile/the-todd-herman-show",
    newUrl: "https://thetoddhermanshow.substack.com",
    note: "The Todd Herman Show Substack (correct newsletter URL)",
  },
];

async function main() {
  const conn = await createConnection(DATABASE_URL);

  console.log("Fixing Substack URLs...\n");

  let fixed = 0;
  let skipped = 0;
  let cleared = 0;

  for (const correction of corrections) {
    if (correction.skip) {
      console.log(`⏭  SKIP  ${correction.authorName}: ${correction.note}`);
      skipped++;
      continue;
    }

    if (correction.newUrl === null) {
      // Remove the incorrect URL
      const [result] = await conn.execute(
        "UPDATE author_profiles SET substackUrl = NULL, updatedAt = NOW() WHERE authorName = ? AND substackUrl = ?",
        [correction.authorName, correction.oldUrl]
      );
      const affected = result.affectedRows;
      if (affected > 0) {
        console.log(`🗑  CLEAR ${correction.authorName}: removed "${correction.oldUrl}" — ${correction.note}`);
        cleared++;
      } else {
        console.log(`⚠  MISS  ${correction.authorName}: row not found or URL already changed`);
      }
    } else {
      // Update to correct URL
      const [result] = await conn.execute(
        "UPDATE author_profiles SET substackUrl = ?, updatedAt = NOW() WHERE authorName = ? AND substackUrl = ?",
        [correction.newUrl, correction.authorName, correction.oldUrl]
      );
      const affected = result.affectedRows;
      if (affected > 0) {
        console.log(`✅ FIX   ${correction.authorName}: "${correction.oldUrl}" → "${correction.newUrl}"`);
        fixed++;
      } else {
        console.log(`⚠  MISS  ${correction.authorName}: row not found or URL already changed`);
      }
    }
  }

  await conn.end();

  console.log(`\nDone. Fixed: ${fixed}, Cleared: ${cleared}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
