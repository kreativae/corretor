"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Abas da página do imóvel. O conteúdo vem pronto do servidor; a aba aberta fica no endereço
 * (#negocio, #historico), então links como "Ver histórico completo" trocam de aba.
 */
export function DetailTabs({ tabs }: { tabs: { id: string; label: string; count?: number; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  function open(id: string) {
    setActive(id);
    history.replaceState(null, "", id === tabs[0]?.id ? window.location.pathname : `#${id}`);
  }

  return (
    <div className="min-w-0">
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-hairline bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => open(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active === t.id ? "bg-ink text-canvas" : "text-subtle hover:bg-soft hover:text-ink",
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={cn("font-mono text-[10.5px]", active === t.id ? "text-canvas/70" : "text-subtle")}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="space-y-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
