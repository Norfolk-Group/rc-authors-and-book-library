/**
 * AdminDependenciesTab — Admin Console: Dependencies section.
 * Wraps DependenciesTab.
 */
import { Package } from "@phosphor-icons/react";
import { DependenciesTab } from "./DependenciesTab";

export function AdminDependenciesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Package className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dependencies</h1>
          <p className="text-muted-foreground text-sm">
            Package versions and dependency status
          </p>
        </div>
      </div>
      <DependenciesTab />
    </div>
  );
}
