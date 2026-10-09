"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Alternar tema"
      className={
        "group inline-flex size-9 items-center justify-center rounded-full border border-hairline text-subtle transition-all duration-300 hover:border-hairline-strong hover:text-ink " +
        (className ?? "")
      }
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4 transition-transform duration-500 group-hover:rotate-90" />
        ) : (
          <Moon className="size-4 transition-transform duration-500 group-hover:-rotate-12" />
        )
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}
