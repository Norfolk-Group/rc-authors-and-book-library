/**
 * AdminTagsTab — Admin Console: Tag Management section.
 * Wraps TagStatisticsCard, TagManagement, and TagTaxonomyMatrix.
 */
import { Tag } from "@phosphor-icons/react";
import { TagStatisticsCard } from "./TagStatisticsCard";
import { TagManagement } from "./TagManagement";
import { TagTaxonomyMatrix } from "./TagTaxonomyMatrix";

export function AdminTagsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Tag className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tag Management</h1>
          <p className="text-muted-foreground text-sm">
            Create, rename, and delete tags for authors and books
          </p>
        </div>
      </div>
      <TagStatisticsCard />
      <TagManagement />
      <TagTaxonomyMatrix />
    </div>
  );
}
