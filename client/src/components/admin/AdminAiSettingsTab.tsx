/**
 * AdminAiSettingsTab — Admin Console: AI Settings section.
 * Wraps AiTab with self-contained settings access via context.
 */
import { Cpu } from "@phosphor-icons/react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { AiTab } from "./AiTab";

export function AdminAiSettingsTab() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Cpu className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground text-sm">
            Configure AI generation parameters and prompts
          </p>
        </div>
      </div>
      <AiTab settings={settings} updateSettings={updateSettings} />
    </div>
  );
}
