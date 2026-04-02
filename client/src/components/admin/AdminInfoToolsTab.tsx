/**
 * AdminInfoToolsTab — Admin Console: Info Tools section.
 * Wraps InformationToolsTab with self-contained settings access via context.
 */
import { Lightning } from "@phosphor-icons/react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { InformationToolsTab } from "./InformationToolsTab";

export function AdminInfoToolsTab() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Lightning className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Info Tools</h1>
          <p className="text-muted-foreground text-sm">
            Research utilities and information lookup tools
          </p>
        </div>
      </div>
      <InformationToolsTab settings={settings} updateSettings={updateSettings} />
    </div>
  );
}
