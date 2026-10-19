"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { type ReactNode, useEffect } from "react";
import { useHydrated } from "@/lib/use-hydrated";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useHydrated();
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
 * Cor da barra do navegador/relógio (theme-color) acompanha o tema escolhido:
 * no iPhone ela tinge o topo da tela; fixa escura deixava o modo claro cinza.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() ||
      (resolvedTheme === "dark" ? "#11112a" : "#f5f5f9");
    let metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (!metas.length) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    }
    metas.forEach((m) => {
      m.removeAttribute("media");
      m.content = color;
    });
  }, [resolvedTheme]);
  return null;
}

/**
 * Tema da VITRINE pública — light por padrão.
 * Persistência independente (imob-theme-site): o visitante pode alternar
 * sem afetar o tema do sistema.
 */
export function SiteTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="imob-theme-site"
      disableTransitionOnChange={false}
    >
      {children}
      <ThemedToaster />
      <ThemeColorSync />
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
      <ThemeColorSync />
    </ThemeProvider>
  );
}
