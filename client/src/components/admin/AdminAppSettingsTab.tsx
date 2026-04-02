/**
 * AdminAppSettingsTab — Admin Console: App Settings section.
 * Wraps SettingsTab with self-contained settings access via context.
 */
import { Gear } from "@phosphor-icons/react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { SettingsTab } from "./SettingsTab";

export function AdminAppSettingsTab() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Gear className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
          <p className="text-muted-foreground text-sm">
            Theme, display, and application preferences
          </p>
        </div>
      </div>
      <SettingsTab settings={settings} updateSettings={updateSettings} />
    </div>
  );
}
