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
 * Grade de indicadores. No celular fica recolhida (sanfona) para não ocupar
 * a tela; do tablet para cima aparece sempre aberta. A escolha fica salva.
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
  const count = Children.toArray(children).filter(Boolean).length;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === "1") setOpen(true);
    } catch {}
  }, []);

  function toggle() {
    setOpen((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  // Desligado em Configurações para esta página
  if (cards && page && !cards[page]) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-hairline bg-card px-4 py-3 text-left text-sm font-medium md:hidden"
      >
        <BarChart3 className="size-4 text-subtle" />
        Indicadores
        <span className="font-mono text-[11px] text-subtle">{count}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-subtle transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          open ? "mt-3 grid" : "hidden",
          "grid-cols-2 md:mt-0 md:grid",
          gridClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
