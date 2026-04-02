/**
 * AdminResearchTab — Admin Console: Research section.
 * Wraps CascadeTab with self-contained data fetching.
 */
import { ChartBar } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc";
import { CascadeTab } from "./CascadeTab";

export function AdminResearchTab() {
  const authorStats = trpc.cascade.authorStats.useQuery(undefined, { staleTime: 60_000 });
  const bookStats = trpc.cascade.bookStats.useQuery(undefined, { staleTime: 60_000 });
  const batchScrapeStats = trpc.apify.getBatchScrapeStats.useQuery(undefined, { staleTime: 60_000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <ChartBar className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research</h1>
          <p className="text-muted-foreground text-sm">
            Live enrichment stats and cascade pipeline status
          </p>
        </div>
      </div>
      <CascadeTab
        aStats={authorStats.data}
        bStats={bookStats.data}
        scrapeStats={batchScrapeStats.data}
      />
    </div>
  );
}
