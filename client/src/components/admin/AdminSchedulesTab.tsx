/**
 * AdminSchedulesTab — Admin Console: Schedules section.
 * Wraps SchedulingTab.
 */
import { CalendarCheck } from "@phosphor-icons/react";
import { SchedulingTab } from "./SchedulingTab";

export function AdminSchedulesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <CalendarCheck className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground text-sm">
            Manage automated task schedules
          </p>
        </div>
      </div>
      <SchedulingTab />
    </div>
  );
}
