"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Busca/filtros recolhidos no celular. Fica dentro de uma linha flex: no
 * celular vira um botão (o conteúdo abre embaixo, na linha inteira); do
 * tablet para cima os filhos aparecem normalmente na linha (display: contents).
 */
export function MobileCollapse({
  label = "Buscar e filtrar",
  count = 0,
  children,
}: {
  label?: string;
  /** Quantos filtros/busca estão ativos — aparece no botão fechado */
  count?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-hairline bg-card px-4 text-sm font-medium md:hidden"
      >
        <SlidersHorizontal className="size-4 shrink-0 text-subtle" />
        <span className="truncate">{label}</span>
        {count > 0 && (
          <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] text-on-accent">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-subtle transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          open ? "flex" : "hidden",
          "order-last basis-full flex-wrap items-center gap-3 md:contents",
          // Busca (primeiro item) na linha inteira no celular
          "[&>*:first-child]:basis-full md:[&>*:first-child]:basis-auto",
        )}
      >
        {children}
      </div>
    </>
  );
}
