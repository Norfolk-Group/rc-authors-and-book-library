/**
 * AdminDigitalMeTab — Admin Console: Digital Me section.
 * Wraps DigitalMeTab.
 */
import { Robot } from "@phosphor-icons/react";
import { DigitalMeTab } from "./DigitalMeTab";

export function AdminDigitalMeTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Robot className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Digital Me</h1>
          <p className="text-muted-foreground text-sm">
            Manage AI personas and RAG profiles for authors
          </p>
        </div>
      </div>
      <DigitalMeTab />
    </div>
  );
}
