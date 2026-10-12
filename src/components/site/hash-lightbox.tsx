"use client";

import { lockScroll } from "@/lib/scroll-lock";
import { X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * Janela (lightbox) que fica oculta e abre ao clicar em qualquer link que
 * termine em `#<hash>` (ex.: "#agendar", "/#fale-conosco") ou ao chegar com
 * esse hash na URL. Trava a rolagem do site por trás; Esc/fundo/X fecham.
 */
export function HashLightbox({
  hash,
  label,
  aside,
  children,
}: {
  hash: string;
  label: string;
  /** Coluna da esquerda (título, textos) */
  aside: ReactNode;
  /** Coluna da direita (formulário) */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    if (location.hash === `#${hash}`) history.replaceState(null, "", location.pathname + location.search);
  }, [hash]);

  useEffect(() => {
    // Captura: roda antes do <Link>, que então não navega
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") ?? "";
      if (href !== `#${hash}` && href !== `/#${hash}`) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (location.hash === `#${hash}`) setOpen(true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      data-lenis-prevent
      role="dialog"
      aria-modal
      aria-label={label}
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
    >
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-md" onClick={close} />
      <div className="animate-slide-in relative grid max-h-[92dvh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-t-3xl border border-hairline bg-canvas shadow-2xl sm:rounded-3xl md:grid-cols-[0.9fr_1.1fr]">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-hairline bg-canvas/80 text-subtle backdrop-blur transition-colors hover:text-ink"
        >
          <X className="size-4" />
        </button>
        <div className="border-b border-hairline p-6 pr-16 md:border-b-0 md:border-r md:p-10">{aside}</div>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
