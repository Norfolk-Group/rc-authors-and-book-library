/**
 * webSearch.router.ts — Web research search (Exa + Perplexity).
 *
 * Exposes server-side web search / answer synthesis to the client. All external
 * API calls happen here — the browser never holds the Exa or Perplexity keys.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { webResearch, exaSearch } from "../enrichment/webSearch";

export const webSearchRouter = router({
  /** Combined web research: Perplexity cited answer + Exa source results. */
  research: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(500),
        numResults: z.number().int().min(1).max(20).optional(),
      })
    )
    .query(async ({ input }) => {
      return webResearch(input.query, input.numResults ?? 8);
    }),

  /** Raw Exa neural web search (sources only). */
  exaSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(500),
        numResults: z.number().int().min(1).max(20).optional(),
      })
    )
    .query(async ({ input }) => {
      const sources = await exaSearch(input.query, input.numResults ?? 8);
      return { query: input.query, sources };
    }),
});
