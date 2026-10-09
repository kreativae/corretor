"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { type ReactNode, useEffect, useState } from "react";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Toaster
      theme={mounted ? (resolvedTheme as "light" | "dark") : "light"}
      position="bottom-right"
      gap={8}
      toastOptions={{
        style: {
          background: "var(--card)",
          border: "1px solid var(--hairline)",
          color: "var(--ink)",
          borderRadius: "14px",
          fontSize: "13.5px",
        },
      }}
    />
  );
}

/**
 * Tema da VITRINE pública — dark por padrão.
 * Persistência independente (imob-theme-site): o visitante pode alternar
 * sem afetar o tema do sistema.
 */
export function SiteTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="imob-theme-site"
      disableTransitionOnChange={false}
    >
      {children}
      <ThemedToaster />
    </ThemeProvider>
  );
}

/**
 * Tema do SISTEMA (CRM + Admin) — light por padrão.
 * Persistência independente (imob-theme-app).
 */
export function AppTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="imob-theme-app"
      disableTransitionOnChange={false}
    >
      {children}
      <ThemedToaster />
    </ThemeProvider>
  );
}
