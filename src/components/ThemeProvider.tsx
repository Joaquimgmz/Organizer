"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Segmented } from "./ui/Field";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "ro-theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (next: Theme) => void;
} | null>(null);

/**
 * "system" removes the attribute entirely and lets the prefers-color-scheme
 * block in globals.css decide — that's what keeps the default free of a
 * blocking inline script. An explicit choice stamps the attribute, which wins
 * over the OS in both directions.
 */
function apply(theme: Theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
    apply(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

/** Three-way light / dark / system switch. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <Segmented
      value={theme}
      onChange={setTheme}
      size={compact ? "sm" : "md"}
      options={[
        {
          value: "light",
          title: "Light",
          label: (
            <span className="flex items-center gap-1.5">
              <Sun className="size-3.5" />
              {!compact && "Light"}
            </span>
          ),
        },
        {
          value: "dark",
          title: "Dark",
          label: (
            <span className="flex items-center gap-1.5">
              <Moon className="size-3.5" />
              {!compact && "Dark"}
            </span>
          ),
        },
        {
          value: "system",
          title: "Match system",
          label: (
            <span className="flex items-center gap-1.5">
              <Monitor className="size-3.5" />
              {!compact && "System"}
            </span>
          ),
        },
      ]}
    />
  );
}
