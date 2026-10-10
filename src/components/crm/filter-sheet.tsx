"use client";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Filtro ativo exibido como chip removível */
export type ActiveChip<T> = { key: string; label: string; clear: Partial<T> };

/** Painel de filtros que desliza da direita para a esquerda. */
export function FilterSheet({
  open,
  onClose,
  onReset,
  title = "Filtros",
  resultLabel,
  activeCount,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  title?: string;
  /** Ex.: "Ver 12 contatos" */
  resultLabel: string;
  activeCount: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal aria-label={title}>
      <div
        className="animate-blur-in absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-4">
          <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-subtle">
            <SlidersHorizontal className="size-3.5" />
            {title}
            {activeCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] tracking-normal text-on-accent">
                {activeCount}
              </span>
            )}
          </p>
          <button
            onClick={onClose}
            aria-label="Fechar filtros"
            className="rounded-full p-2 text-subtle transition-colors hover:bg-soft hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">{children}</div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline px-6 py-4">
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
            Limpar tudo
          </button>
          <Button variant="accent" onClick={onClose}>
            {resultLabel}
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function FilterChip({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        on
          ? "border-transparent bg-ink text-canvas"
          : "border-hairline text-subtle hover:border-ink/30 hover:text-ink",
      )}
    >
      {children}
      {count != null && <span className="font-mono text-[10px] opacity-60">{count}</span>}
    </button>
  );
}

export function FilterGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">{title}</p>
      {children}
    </div>
  );
}

/** Botão "Filtros" da barra de ferramentas, com o número de filtros ativos */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button variant={count ? "primary" : "outline"} onClick={onClick}>
      <SlidersHorizontal className="size-4" />
      Filtros
      {count > 0 && (
        <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] text-on-accent">
          {count}
        </span>
      )}
    </Button>
  );
}

export function ActiveChips<T>({
  chips,
  onClear,
  onClearAll,
}: {
  chips: ActiveChip<T>[];
  onClear: (patch: Partial<T>) => void;
  onClearAll?: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onClear(c.clear)}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-accent/20"
        >
          {c.label}
          <X className="size-3 text-subtle" />
        </button>
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-[11px] text-subtle underline underline-offset-4 hover:text-ink"
        >
          limpar filtros
        </button>
      )}
    </div>
  );
}
