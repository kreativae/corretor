"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Seção com título que, no celular, abre e fecha (sanfona) e, do tablet para
 * cima, fica sempre aberta com o título fixo.
 */
export function MobileSection({
  title,
  meta,
  children,
  className,
}: {
  title: ReactNode;
  /** Texto curto à direita do título (ex.: "última: há 2 h") */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left md:pointer-events-none"
      >
        <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
        <span className="flex items-center gap-2">
          {meta && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">{meta}</span>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-subtle transition-transform duration-300 md:hidden",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <div className={cn(open ? "block" : "hidden", "mt-4 md:block")}>{children}</div>
    </div>
  );
}
