/**
 * enrich-platforms.ts
 * Re-runs the discoverAuthorPlatforms pipeline for all authors.
 * Uses forceRefresh=true to update all, not just stale ones.
 * Run with: npx tsx scripts/enrich-platforms.ts
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { authorProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { discoverAuthorPlatforms } from "../server/enrichment/platforms";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not configured");

  const allAuthors = await db
    .select({ authorName: authorProfiles.authorName, platformEnrichmentStatus: authorProfiles.platformEnrichmentStatus })
    .from(authorProfiles)
    .limit(500);

  // Force-refresh all authors to pick up the updated multi-website prompt
  const toProcess = allAuthors;

  console.log(`[enrich-platforms] ${toProcess.length} authors to process (${allAuthors.length - toProcess.length} recently enriched, skipping)`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const author = toProcess[i];
    try {
      process.stdout.write(`[${i + 1}/${toProcess.length}] ${author.authorName} ... `);
      const result = await discoverAuthorPlatforms(author.authorName, perplexityKey);
      const { links } = result;
      const updatePayload: Record<string, string | null> = {};
      if (links.websiteUrl !== undefined) updatePayload.websiteUrl = links.websiteUrl;
      if (links.twitterUrl !== undefined) updatePayload.twitterUrl = links.twitterUrl;
      if (links.linkedinUrl !== undefined) updatePayload.linkedinUrl = links.linkedinUrl;
      if (links.substackUrl !== undefined) updatePayload.substackUrl = links.substackUrl;
      if (links.youtubeUrl !== undefined) updatePayload.youtubeUrl = links.youtubeUrl;
      if (links.facebookUrl !== undefined) updatePayload.facebookUrl = links.facebookUrl;
      if (links.instagramUrl !== undefined) updatePayload.instagramUrl = links.instagramUrl;
      if (links.tiktokUrl !== undefined) updatePayload.tiktokUrl = links.tiktokUrl;
      if (links.githubUrl !== undefined) updatePayload.githubUrl = links.githubUrl;
      if (links.businessWebsiteUrl !== undefined) updatePayload.businessWebsiteUrl = links.businessWebsiteUrl;
      if (links.newsletterUrl !== undefined) updatePayload.newsletterUrl = links.newsletterUrl;
      if (links.speakingUrl !== undefined) updatePayload.speakingUrl = links.speakingUrl;
      if (links.podcastUrl !== undefined) updatePayload.podcastUrl = links.podcastUrl;
      if (links.blogUrl !== undefined) updatePayload.blogUrl = links.blogUrl;
      if (links.websites && links.websites.length > 0) updatePayload.websitesJson = JSON.stringify(links.websites);

      const platformStatus = {
        enrichedAt: result.enrichedAt,
        source: result.source,
        platformCount: Object.keys(links).length,
        platforms: Object.keys(links),
      };

      await db
        .update(authorProfiles)
        .set({
          ...updatePayload,
          platformEnrichmentStatus: JSON.stringify(platformStatus),
        })
        .where(eq(authorProfiles.authorName, author.authorName));

      const platformCount = Object.keys(links).filter(k => k !== 'websites').length;
      console.log(`✓ (${platformCount} platforms)`);
      succeeded++;
    } catch (err) {
      console.log(`✗ ERROR: ${err}`);
      failed++;
    }
    // Rate-limit delay
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`\n[enrich-platforms] Done. Succeeded: ${succeeded}, Failed: ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[enrich-platforms] Fatal error:", err);
  process.exit(1);
});
