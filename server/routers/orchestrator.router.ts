/**
 * orchestrator.router.ts
 *
 * Admin-only tRPC router for the Autonomous Enrichment Orchestrator.
 * Provides live job monitoring, schedule management, and manual pipeline triggers.
 */

import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { enrichmentSchedules, enrichmentJobs } from "../../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  triggerPipeline,
  getRegisteredPipelines,
  seedDefaultSchedules,
} from "../services/enrichmentOrchestrator.service";

export const orchestratorRouter = router({
  /**
   * List all pipeline schedules with their current status.
   */
  listSchedules: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(enrichmentSchedules)
      .orderBy(desc(enrichmentSchedules.priority));
  }),

  /**
   * Enable or disable a pipeline schedule.
   */
  toggleSchedule: adminProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(enrichmentSchedules)
        .set({ enabled: input.enabled ? 1 : 0, updatedAt: new Date() })
        .where(eq(enrichmentSchedules.id, input.id));
      return { success: true };
    }),

  /**
   * Update schedule configuration (interval, batch size, concurrency, priority).
   */
  updateSchedule: adminProcedure
    .input(
      z.object({
        id: z.number(),
        intervalHours: z.number().min(1).max(8760).optional(),
        batchSize: z.number().min(1).max(1000).optional(),
        concurrency: z.number().min(1).max(20).optional(),
        priority: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updates } = input;
      await db
        .update(enrichmentSchedules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(enrichmentSchedules.id, id));
      return { success: true };
    }),

  /**
   * Manually trigger a pipeline run immediately.
   * Returns the job ID for progress tracking.
   */
  triggerPipeline: adminProcedure
    .input(
      z.object({
        pipelineKey: z.string(),
        batchSize: z.number().min(1).max(1000).optional(),
        concurrency: z.number().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const jobId = await triggerPipeline(
        input.pipelineKey,
        input.batchSize ?? 20,
        input.concurrency ?? 2
      );
      return { jobId };
    }),

  /**
   * Get recent job runs (last 50).
   */
  listJobs: adminProcedure
    .input(
      z.object({
        pipelineKey: z.string().optional(),
        status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input.pipelineKey) {
        conditions.push(eq(enrichmentJobs.pipelineKey, input.pipelineKey));
      }
      if (input.status) {
        conditions.push(eq(enrichmentJobs.status, input.status));
      }
      return db
        .select()
        .from(enrichmentJobs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(enrichmentJobs.createdAt))
        .limit(input.limit);
    }),

  /**
   * Get a single job by ID for live progress polling.
   */
  getJob: adminProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(enrichmentJobs)
        .where(eq(enrichmentJobs.id, input.jobId))
        .limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Get pipeline coverage statistics — how many entities have been enriched.
   */
  getCoverageStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const [authorStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 ELSE 0 END) as withBio,
        SUM(CASE WHEN richBioJson IS NOT NULL THEN 1 ELSE 0 END) as withRichBio,
        SUM(CASE WHEN websiteUrl IS NOT NULL THEN 1 ELSE 0 END) as withWebsite,
        SUM(CASE WHEN twitterUrl IS NOT NULL THEN 1 ELSE 0 END) as withTwitter,
        SUM(CASE WHEN linkedinUrl IS NOT NULL THEN 1 ELSE 0 END) as withLinkedin,
        SUM(CASE WHEN socialStatsJson IS NOT NULL THEN 1 ELSE 0 END) as withSocialStats,
        SUM(CASE WHEN enrichedAt IS NOT NULL THEN 1 ELSE 0 END) as enriched,
        SUM(CASE WHEN avatarUrl IS NOT NULL THEN 1 ELSE 0 END) as withAvatar
      FROM author_profiles
    `);

    const [bookStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) as withSummary,
        SUM(CASE WHEN richSummaryJson IS NOT NULL THEN 1 ELSE 0 END) as withRichSummary,
        SUM(CASE WHEN coverImageUrl IS NOT NULL THEN 1 ELSE 0 END) as withCover,
        SUM(CASE WHEN isbn IS NOT NULL THEN 1 ELSE 0 END) as withIsbn,
        SUM(CASE WHEN amazonUrl IS NOT NULL THEN 1 ELSE 0 END) as withAmazon,
        SUM(CASE WHEN enrichedAt IS NOT NULL THEN 1 ELSE 0 END) as enriched
      FROM book_profiles
    `);

    const [contentStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN url IS NOT NULL AND url != '' THEN 1 ELSE 0 END) as withUrl,
        SUM(CASE WHEN qualityScore IS NOT NULL THEN 1 ELSE 0 END) as withQualityScore,
        SUM(CASE WHEN isAlive = 0 THEN 1 ELSE 0 END) as deadLinks,
        SUM(CASE WHEN isAlive = 1 THEN 1 ELSE 0 END) as aliveLinks,
        ROUND(AVG(CASE WHEN qualityScore IS NOT NULL THEN qualityScore ELSE NULL END), 1) as avgQualityScore,
        SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as withDescription
      FROM content_items
      WHERE includedInLibrary = 1
    `);

    const [queueStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN reviewType = 'chatbot_candidate' THEN 1 ELSE 0 END) as chatbotCandidates,
        SUM(CASE WHEN reviewType = 'near_duplicate' THEN 1 ELSE 0 END) as nearDuplicates,
        SUM(CASE WHEN reviewType = 'url_quality' THEN 1 ELSE 0 END) as urlQuality,
        SUM(CASE WHEN reviewType = 'link_merit' THEN 1 ELSE 0 END) as linkMerit
      FROM human_review_queue
    `);

    const [jobStats] = await db.execute(sql`
      SELECT
        COUNT(*) as totalJobs,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as runningJobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedJobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedJobs,
        SUM(succeededItems) as totalSucceeded,
        SUM(failedItems) as totalFailed
      FROM enrichment_jobs
    `);

    return {
      authors: ((authorStats as unknown) as Record<string, unknown>[])[0] ?? {},
      books: ((bookStats as unknown) as Record<string, unknown>[])[0] ?? {},
      content: ((contentStats as unknown) as Record<string, unknown>[])[0] ?? {},
      queue: ((queueStats as unknown) as Record<string, unknown>[])[0] ?? {},
      jobs: ((jobStats as unknown) as Record<string, unknown>[])[0] ?? {},
    };
  }),

  /**
   * Get the list of all registered pipeline keys.
   */
  listPipelineKeys: adminProcedure.query(() => {
    return getRegisteredPipelines();
  }),

  /**
   * Re-seed default schedules (admin utility).
   */
  reseedSchedules: adminProcedure.mutation(async () => {
    await seedDefaultSchedules();
    return { success: true };
  }),

  /**
   * Cancel a running job (marks it as cancelled in DB — doesn't actually stop the async work).
   */
  cancelJob: adminProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(enrichmentJobs)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(
          and(
            eq(enrichmentJobs.id, input.jobId),
            eq(enrichmentJobs.status, "running")
          )
        );
      return { success: true };
    }),

  /**
   * Trigger ALL registered pipelines in sequence (one job per pipeline).
   * Returns the list of job IDs created. Pipelines run in parallel fire-and-forget.
   */
  runAllPipelines: adminProcedure
    .input(
      z.object({
        batchSize: z.number().min(1).max(1000).default(20),
        concurrency: z.number().min(1).max(10).default(2),
      })
    )
    .mutation(async ({ input }) => {
      const pipelines = getRegisteredPipelines();
      const jobIds: number[] = [];
      for (const pipelineKey of pipelines) {
        try {
          const jobId = await triggerPipeline(pipelineKey, input.batchSize, input.concurrency);
          jobIds.push(jobId);
        } catch {
          // skip pipelines that fail to start
        }
      }
      return { triggered: jobIds.length, total: pipelines.length, jobIds };
    }),

  /**
   * Get recent job activity for the last 24 hours (for sparkline charts).
   */
  getJobActivity: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return db
      .select({
        pipelineKey: enrichmentJobs.pipelineKey,
        status: enrichmentJobs.status,
        succeededItems: enrichmentJobs.succeededItems,
        failedItems: enrichmentJobs.failedItems,
        startedAt: enrichmentJobs.startedAt,
        completedAt: enrichmentJobs.completedAt,
      })
      .from(enrichmentJobs)
      .where(gte(enrichmentJobs.createdAt, since))
      .orderBy(desc(enrichmentJobs.createdAt))
      .limit(100);
  }),
});
