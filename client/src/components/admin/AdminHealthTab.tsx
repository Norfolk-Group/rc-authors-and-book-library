/**
 * AdminHealthTab — Admin Console: Health section.
 * Wraps ToolHealthCheckTab.
 */
import { Heartbeat } from "@phosphor-icons/react";
import { ToolHealthCheckTab } from "./ToolHealthCheckTab";

export function AdminHealthTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Heartbeat className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health</h1>
          <p className="text-muted-foreground text-sm">
            Tool function checks and service status
          </p>
        </div>
      </div>
      <ToolHealthCheckTab />
    </div>
  );
}
