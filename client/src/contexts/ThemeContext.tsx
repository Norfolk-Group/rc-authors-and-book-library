import React, { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "light" | "dark";

interface ThemeContextType {
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  theme: "light" | "dark";
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark";
  switchable?: boolean;
}

const THEME_STORAGE_KEY = "ncg-app-theme";

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = true,
}: ThemeProviderProps) {
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      // Support legacy values from old theme system
      if (stored === "noir-dark" || stored === "dark") return "dark";
      if (stored === "norfolk-ai" || stored === "light") return "light";
    } catch {}
    return defaultTheme ?? "light";
  });

  const theme: "light" | "dark" = appTheme;

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes first (including legacy ones)
    root.classList.remove("dark", "light", "norfolk-ai", "noir-dark");
    // Apply standard .dark class for dark mode (used by Tailwind + shadcn)
    if (appTheme === "dark") {
      root.classList.add("dark");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, appTheme);
    } catch {}
  }, [appTheme]);

  const setAppTheme = (t: AppTheme) => setAppThemeState(t);

  const toggleTheme = switchable
    ? () => setAppThemeState(prev => prev === "dark" ? "light" : "dark")
    : undefined;

  return (
    <ThemeContext.Provider value={{ appTheme, setAppTheme, theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
