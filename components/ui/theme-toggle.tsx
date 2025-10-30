"use client";

import * as React from "react";
import { Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THEME_ORDER = ["light", "dark", "dracula"] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = React.useMemo(() => {
    if (!mounted) return "light";
    if (theme === "system") {
      return (resolvedTheme as (typeof THEME_ORDER)[number]) ?? "light";
    }
    if (THEME_ORDER.includes(theme as (typeof THEME_ORDER)[number])) {
      return theme as (typeof THEME_ORDER)[number];
    }
    return "light";
  }, [mounted, theme, resolvedTheme]);

  const currentIndex = THEME_ORDER.indexOf(currentTheme as (typeof THEME_ORDER)[number]);
  const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length] ?? "dark";

  const label = mounted ? `Switch to ${nextTheme} theme` : "Toggle color theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={() => setTheme(nextTheme)}
      className="relative inline-flex items-center gap-2"
    >
      <IconDisplay currentTheme={currentTheme} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function IconDisplay({ currentTheme }: { currentTheme: "light" | "dark" | "dracula" }) {
  return (
    <>
      <Sun
        className={cn(
          "h-4 w-4 transition-all",
          currentTheme === "light" ? "rotate-0 scale-100" : "-rotate-90 scale-0",
        )}
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all",
          currentTheme === "dark"
            ? "rotate-0 scale-100"
            : currentTheme === "light"
              ? "rotate-90 scale-0"
              : "-rotate-90 scale-0",
        )}
      />
      <Palette
        className={cn(
          "absolute h-4 w-4 transition-all",
          currentTheme === "dracula" ? "rotate-0 scale-100" : "-rotate-90 scale-0",
        )}
      />
    </>
  );
}
