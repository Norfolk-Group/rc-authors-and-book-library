/**
 * run_all_pipelines.ts
 * Triggers all enrichment pipelines in priority order:
 * 1. enrich-social-stats  (Substack post counts + Wikipedia + LinkedIn)
 * 2. pinecone-index-authors
 * 3. pinecone-index-books
 * 4. pinecone-index-articles
 * 5. rag-readiness-scan
 * 6. chatbot-candidate-scan
 * 7. enrich-bios
 * 8. discover-platforms
 */

import "dotenv/config";
import { triggerPipeline, getRegisteredPipelines } from "../server/services/enrichmentOrchestrator.service.js";

const PRIORITY_PIPELINES = [
  "enrich-social-stats",       // Substack post counts, Wikipedia, LinkedIn, Twitter
  "pinecone-index-authors",    // Embed + upsert all authors to Pinecone
  "pinecone-index-books",      // Embed + upsert all books to Pinecone
  "pinecone-index-articles",   // Embed + upsert all magazine articles to Pinecone
  "rag-readiness-scan",        // Compute RAG readiness scores
  "chatbot-candidate-scan",    // Identify chatbot-ready authors
  "enrich-bios",               // Fill missing author bios
  "discover-platforms",        // Discover missing platform URLs
];

async function main() {
  const registered = getRegisteredPipelines();
  console.log(`=== ENRICHMENT ORCHESTRATOR RUN ===`);
  console.log(`Registered pipelines: ${registered.join(", ")}`);
  console.log(`Running ${PRIORITY_PIPELINES.length} pipelines...\n`);

  const results: { pipeline: string; jobId?: number; error?: string }[] = [];

  for (const pipelineKey of PRIORITY_PIPELINES) {
    if (!registered.includes(pipelineKey)) {
      console.log(`  ⚠ Skipping unknown pipeline: ${pipelineKey}`);
      results.push({ pipeline: pipelineKey, error: "not registered" });
      continue;
    }
    try {
      console.log(`  → Triggering: ${pipelineKey}...`);
      const jobId = await triggerPipeline(pipelineKey, 50, 5);
      console.log(`  ✓ Job ${jobId} started for ${pipelineKey}`);
      results.push({ pipeline: pipelineKey, jobId });
      // Small delay between pipeline triggers to avoid overwhelming the DB
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`  ✗ Failed to trigger ${pipelineKey}: ${err.message}`);
      results.push({ pipeline: pipelineKey, error: err.message });
    }
  }

  console.log(`\n=== TRIGGER SUMMARY ===`);
  for (const r of results) {
    if (r.jobId) {
      console.log(`  ✓ ${r.pipeline} → job #${r.jobId}`);
    } else {
      console.log(`  ✗ ${r.pipeline} → ${r.error}`);
    }
  }

  const succeeded = results.filter(r => r.jobId).length;
  const failed = results.filter(r => r.error).length;
  console.log(`\nTriggered: ${succeeded} | Failed: ${failed}`);
  console.log(`\nPipelines are running in the background. Check Admin Console → Intelligence Dashboard for live status.`);

  // Wait 30s then check job status
  console.log(`\nWaiting 30s to check initial job progress...`);
  await new Promise(r => setTimeout(r, 30000));

  // Check job activity
  const { getDb } = await import("../server/db.js");
  const { enrichmentJobs } = await import("../drizzle/schema.js");
  const { desc } = await import("drizzle-orm");
  const db = getDb();
  const recentJobs = await db.select().from(enrichmentJobs).orderBy(desc(enrichmentJobs.startedAt)).limit(20);
  
  console.log(`\n=== JOB STATUS (30s after trigger) ===`);
  for (const job of recentJobs) {
    const status = job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : job.status === "running" ? "⟳" : "○";
    const processed = job.processedCount ?? 0;
    const total = job.totalCount ?? "?";
    console.log(`  ${status} [${job.id}] ${job.pipelineKey} — ${job.status} (${processed}/${total}) ${job.errorMessage ? "ERR: " + job.errorMessage : ""}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
