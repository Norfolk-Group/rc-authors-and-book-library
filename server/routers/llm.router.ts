/**
 * LLM Router — vendor/model catalogue with task-based recommendation engine.
 *
 * The vendor catalogue, types, and recommendation engine live in:
 *   server/lib/llmCatalogue.ts
 *
 * This file contains only the tRPC procedures that expose the catalogue to the frontend.
 */
import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  USE_CASES,
  VENDOR_CATALOGUE,
  VENDOR_CATALOGUE_RAW,
  applyRecommendations,
  getRecommendedModel,
  findVendor,
} from "../lib/llmCatalogue";

// Re-export everything consumers need
export type { UseCase, LLMModel, LLMVendor } from "../lib/llmCatalogue";
export {
  USE_CASES,
  VENDOR_CATALOGUE,
  DEFAULT_PRIMARY_VENDOR,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_SECONDARY_VENDOR,
  DEFAULT_SECONDARY_MODEL,
  applyRecommendations,
  getRecommendedModel,
  findVendor,
  findModel,
} from "../lib/llmCatalogue";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const llmRouter = router({
  /** Return the full vendor catalogue with current recommendations applied */
  listVendors: publicProcedure.query(() => {
    return VENDOR_CATALOGUE;
  }),

  /**
   * Return models for a specific vendor.
   * Falls back to all Google models if vendorId is not found.
   */
  listModels: publicProcedure
    .input(z.object({ vendorId: z.string().optional() }))
    .query(({ input }) => {
      const vendor = input.vendorId
        ? findVendor(input.vendorId)
        : findVendor("google");
      return vendor?.models ?? findVendor("google")!.models;
    }),

  /**
   * Refresh the vendor catalogue.
   * Re-runs the recommendation engine so recommendations stay current.
   */
  refreshVendors: adminProcedure.mutation(() => {
    const refreshed = applyRecommendations(VENDOR_CATALOGUE_RAW);
    const allRecs: Record<string, ReturnType<typeof getRecommendedModel>> = {};
    for (const uc of USE_CASES) {
      allRecs[uc] = getRecommendedModel(uc);
    }
    return {
      vendors: refreshed,
      refreshedAt: new Date(),
      vendorCount: refreshed.length,
      modelCount: refreshed.reduce((s, v) => s + v.models.length, 0),
      recommendations: allRecs,
    };
  }),

  /**
   * Get current recommendations for all use cases.
   * Used by the UI to highlight the recommended model in each selector.
   */
  getRecommendations: publicProcedure.query(() => {
    const recs: Record<string, ReturnType<typeof getRecommendedModel>> = {};
    for (const uc of USE_CASES) {
      recs[uc] = getRecommendedModel(uc);
    }
    return {
      recommendations: recs,
      useCases: USE_CASES,
      updatedAt: new Date(),
    };
  }),

  /**
   * Get the recommended model for a specific task/use case.
   * Returns vendor + model + reason. UI can use this for the "Auto-Recommend" button.
   */
  recommendForTask: publicProcedure
    .input(z.object({ useCase: z.enum(USE_CASES) }))
    .query(({ input }) => {
      return getRecommendedModel(input.useCase);
    }),

  /** Test a model with a lightweight ping — returns latency in ms */
  testModel: adminProcedure
    .input(
      z.object({ modelId: z.string(), vendorId: z.string().optional() })
    )
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const result = await invokeLLM({
          model: input.modelId,
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
        });
        const latencyMs = Date.now() - start;
        const content = result.choices[0]?.message?.content;
        const text =
          typeof content === "string" ? content : JSON.stringify(content);
        return {
          success: true,
          latencyMs,
          response: text.trim().slice(0, 100),
        };
      } catch (err) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
});
