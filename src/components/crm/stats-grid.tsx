"use client";

import { statCardKeyFor, type StatCards } from "@/lib/stat-cards";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const KEY = "crm-stats-open";

/** Quais páginas exibem os cards (Configurações › Cards de indicadores) */
const StatCardsContext = createContext<StatCards | undefined>(undefined);

export function StatCardsProvider({ value, children }: { value?: StatCards; children: ReactNode }) {
  return <StatCardsContext.Provider value={value}>{children}</StatCardsContext.Provider>;
}

/**
 * Grade de indicadores. Modo "aberto": no celular fica recolhida (sanfona) e do
 * tablet para cima aparece aberta. Modo "minimizado" (Configurações): recolhida
 * em todas as telas, abre com um clique. A escolha de cada página fica salva.
 */
export function StatsGrid({
  className,
  gridClassName,
  children,
}: {
  /** Classes do bloco (margens) */
  className?: string;
  /** Classes da grade (colunas, espaçamento) */
  gridClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const cards = useContext(StatCardsContext);
  const page = statCardKeyFor(usePathname());
  const mode = (cards && page && cards[page]) || "aberto";
  const minimized = mode === "minimizado";
  const storeKey = minimized ? `${KEY}:${page}` : KEY;
  const count = Children.toArray(children).filter(Boolean).length;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(localStorage.getItem(storeKey) === "1");
    } catch {}
  }, [storeKey]);

  function toggle() {
    setOpen((v) => {
      try {
        localStorage.setItem(storeKey, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  // Oculto em Configurações para esta página
  if (mode === "oculto") return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-2xl border border-hairline bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-soft/60",
          !minimized && "md:hidden",
        )}
      >
        <BarChart3 className="size-4 text-subtle" />
        Indicadores
        <span className="font-mono text-[11px] text-subtle">{count}</span>
        <span className="ml-auto hidden text-xs font-normal text-subtle sm:inline">
          {open ? "Minimizar" : "Ver indicadores"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-subtle transition-transform duration-300 max-sm:ml-auto",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          open ? "mt-3 grid" : "hidden",
          "grid-cols-2",
          !minimized && "md:mt-0 md:grid",
          gridClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
