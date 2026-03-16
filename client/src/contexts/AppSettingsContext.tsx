/**
 * AppSettingsContext — Global App Preferences
 *
 * Single source of truth for:
 *   - Active theme name (manus | norfolk-ai | noir-dark)
 *   - Active icon set (phosphor-regular | phosphor-duotone)
 *
 * Persists to localStorage. Applies theme class to <html> element.
 *
 * Usage:
 *   const { settings, updateSettings } = useAppSettings();
 *   updateSettings({ theme: "noir-dark" });
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeName = "manus" | "norfolk-ai" | "noir-dark";
export type IconSetId = "phosphor-regular" | "phosphor-duotone";

export interface AppSettings {
  theme: ThemeName;
  iconSet: IconSetId;
}

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  theme: "manus",        // Manus is the default theme
  iconSet: "phosphor-regular",
};

const STORAGE_KEY = "app-settings-v1";

// ── Context ───────────────────────────────────────────────────────────────────

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  // Apply theme class to <html> whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    // Remove all known theme classes
    root.classList.remove("theme-manus", "theme-norfolk-ai", "theme-noir-dark");
    root.classList.add(`theme-${settings.theme}`);
    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextType {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}
