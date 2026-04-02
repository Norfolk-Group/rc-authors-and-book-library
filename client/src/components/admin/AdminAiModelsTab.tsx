/**
 * AdminAiModelsTab — Admin Console: AI Models section.
 * Wraps AIModelConfigTab.
 */
import { Cpu as CircuitBoard } from "@phosphor-icons/react";
import { AIModelConfigTab } from "./AIModelConfigTab";

export function AdminAiModelsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <CircuitBoard className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Models</h1>
          <p className="text-muted-foreground text-sm">
            Select and configure LLM providers and models
          </p>
        </div>
      </div>
      <AIModelConfigTab />
    </div>
  );
}
