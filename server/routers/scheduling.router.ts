/**
 * scheduling.router.ts
 * Manages enrichment pipeline schedules and job history.
 * Backed by the enrichmentSchedules and enrichmentJobs tables.
 */
import { z } from "zod";
import { desc, eq, asc } from "drizzle-orm";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { enrichmentSchedules, enrichmentJobs } from "../../drizzle/schema";

// ── Default pipeline seeds ─────────────────────────────────────────────────────
const DEFAULT_PIPELINES = [
  {
    pipelineKey: "enrich-author-bios",
    label: "Enrich Author Bios",
    entityType: "author" as const,
    intervalHours: 720,
    priority: 5,
  },
  {
    pipelineKey: "enrich-social-stats",
    label: "Enrich Social Stats",
    entityType: "author" as const,
    intervalHours: 168,
    priority: 7,
  },
  {
    pipelineKey: "discover-platforms",
    label: "Discover Author Platforms",
    entityType: "author" as const,
    intervalHours: 720,
    priority: 6,
  },
  {
    pipelineKey: "enrich-rich-bios",
    label: "Enrich Rich Bios",
    entityType: "author" as const,
    intervalHours: 2160,
    priority: 4,
  },
  {
    pipelineKey: "enrich-book-summaries",
    label: "Enrich Book Summaries",
    entityType: "book" as const,
    intervalHours: 720,
    priority: 5,
  },
  {
    pipelineKey: "enrich-rich-summaries",
    label: "Enrich Rich Summaries",
    entityType: "book" as const,
    intervalHours: 2160,
    priority: 4,
  },
] as const;

export const schedulingRouter = router({
  /**
   * List all enrichment schedules.
   * Auto-seeds defaults if the table is empty.
   */
  listSchedules: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(enrichmentSchedules)
      .orderBy(desc(enrichmentSchedules.priority), asc(enrichmentSchedules.pipelineKey));
    // Seed defaults if empty
    if (rows.length === 0) {
      await db.insert(enrichmentSchedules).values(
        DEFAULT_PIPELINES.map((p) => ({
          pipelineKey: p.pipelineKey,
          label: p.label,
          entityType: p.entityType,
          intervalHours: p.intervalHours,
          priority: p.priority,
          enabled: 0,
          batchSize: 10,
          concurrency: 2,
        }))
      );
      return db
        .select()
        .from(enrichmentSchedules)
        .orderBy(desc(enrichmentSchedules.priority), asc(enrichmentSchedules.pipelineKey));
    }
    return rows;
  }),

  /**
   * List recent job executions.
   */
  listRecentJobs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(enrichmentJobs)
        .orderBy(desc(enrichmentJobs.createdAt))
        .limit(input.limit);
    }),

  /**
   * Toggle a schedule's enabled state.
   */
  toggleSchedule: adminProcedure
    .input(z.object({
      pipelineKey: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Upsert — create if not exists
      const existing = await db
        .select({ id: enrichmentSchedules.id })
        .from(enrichmentSchedules)
        .where(eq(enrichmentSchedules.pipelineKey, input.pipelineKey))
        .limit(1);
      if (existing.length === 0) {
        const def = DEFAULT_PIPELINES.find((p) => p.pipelineKey === input.pipelineKey);
        if (!def) throw new Error(`Unknown pipeline: ${input.pipelineKey}`);
        await db.insert(enrichmentSchedules).values({
          pipelineKey: def.pipelineKey,
          label: def.label,
          entityType: def.entityType,
          intervalHours: def.intervalHours,
          priority: def.priority,
          enabled: input.enabled ? 1 : 0,
          batchSize: 10,
          concurrency: 2,
        });
      } else {
        await db
          .update(enrichmentSchedules)
          .set({ enabled: input.enabled ? 1 : 0 })
          .where(eq(enrichmentSchedules.pipelineKey, input.pipelineKey));
      }
      return { success: true, pipelineKey: input.pipelineKey, enabled: input.enabled };
    }),

  /**
   * Trigger a pipeline manually — creates a job record and returns it.
   * The actual execution is handled by the specific pipeline procedures
   * (e.g., enrichSocialStatsBatch) — this just records the intent.
   */
  triggerPipeline: adminProcedure
    .input(z.object({ pipelineKey: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Create a job record
      await db.insert(enrichmentJobs).values({
        pipelineKey: input.pipelineKey,
        status: "queued",
        triggeredBy: "manual",
        totalItems: 0,
        processedItems: 0,
        succeededItems: 0,
        failedItems: 0,
        skippedItems: 0,
        progress: 0,
        message: "Queued for manual execution",
        startedAt: new Date(),
      });
      // Update lastRunAt on the schedule
      await db
        .update(enrichmentSchedules)
        .set({ lastRunAt: new Date() })
        .where(eq(enrichmentSchedules.pipelineKey, input.pipelineKey));
      return {
        success: true,
        pipelineKey: input.pipelineKey,
        message: `Pipeline "${input.pipelineKey}" queued. Use the pipeline-specific ActionCard to execute it.`,
      };
    }),
});
