/**
 * AdminAboutTab — Admin Console: About section.
 * Wraps AboutTab with self-contained settings access via context.
 */
import { Info } from "@phosphor-icons/react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { AboutTab } from "./AboutTab";

export function AdminAboutTab() {
  const { settings } = useAppSettings();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Info className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">About</h1>
          <p className="text-muted-foreground text-sm">
            Application version, credits, and documentation
          </p>
        </div>
      </div>
      <AboutTab settings={settings} />
    </div>
  );
}
