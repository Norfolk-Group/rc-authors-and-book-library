/**
 * AdminSyncTab — Admin Console: Sync & Storage section.
 * Wraps SyncJobsTab.
 */
import { Cloud } from "@phosphor-icons/react";
import { SyncJobsTab } from "./SyncJobsTab";

export function AdminSyncTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Cloud className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync & Storage</h1>
          <p className="text-muted-foreground text-sm">
            Manage cloud storage connections and sync jobs
          </p>
        </div>
      </div>
      <SyncJobsTab />
    </div>
  );
}
