/**
 * AdminContentItemsTab — Admin Console: Content Items section.
 * Wraps BulkUrlImportPanel and BookMigrationPanel.
 */
import { Globe } from "@phosphor-icons/react";
import { BulkUrlImportPanel } from "./BulkUrlImportPanel";
import { BookMigrationPanel } from "./BookMigrationPanel";

export function AdminContentItemsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Globe className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Items</h1>
          <p className="text-muted-foreground text-sm">
            Import and manage media content items (YouTube, podcasts, articles, TED talks, papers)
          </p>
        </div>
      </div>
      <BulkUrlImportPanel />
      <BookMigrationPanel />
    </div>
  );
}
