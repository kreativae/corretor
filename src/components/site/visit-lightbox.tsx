"use client";

import { VisitForm } from "@/components/site/visit-form";
import type { SiteContent } from "@/lib/site-content";
import { Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Visita guiada em janela (lightbox). Fica oculta na página e abre ao clicar
 * em qualquer link para "#agendar" (ou ao chegar com #agendar na URL).
 */
export function VisitLightbox({
  propertyId,
  propertyCode,
  propertyTitle,
  eyebrow,
  title,
  bullets,
  texts,
}: {
  propertyId: string;
  propertyCode: string;
  propertyTitle: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  texts: SiteContent["visit"];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    if (location.hash === "#agendar") history.replaceState(null, "", location.pathname + location.search);
  }, []);

  // Intercepta os botões "Agendar visita" da página
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href="#agendar"]');
      if (!a) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (location.hash === "#agendar") setOpen(true);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Esc fecha; página não rola por trás
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;
  const list = bullets.filter(Boolean);

  return (
    <div
      data-lenis-prevent
      role="dialog"
      aria-modal
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
    >
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-md" onClick={close} />
      <div className="animate-slide-in relative grid max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-hairline bg-canvas shadow-2xl sm:rounded-3xl md:grid-cols-[0.9fr_1.1fr]">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-hairline bg-canvas/80 text-subtle backdrop-blur transition-colors hover:text-ink"
        >
          <X className="size-4" />
        </button>

        <div className="border-b border-hairline p-6 pr-16 md:border-b-0 md:border-r md:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">{eyebrow}</p>
          <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-[-0.02em] md:text-4xl">
            {title}
          </h2>
          <p className="mt-3 truncate text-sm text-subtle">
            <span className="font-mono text-xs">{propertyCode}</span> · {propertyTitle}
          </p>
          {list.length > 0 && (
            <ul className="mt-6 hidden space-y-3.5 sm:block md:mt-8">
              {list.map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-subtle">
                  <Sparkles className="size-4 shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 md:p-8">
          <VisitForm
            propertyId={propertyId}
            propertyCode={propertyCode}
            texts={texts}
            className="border-0 bg-transparent p-2 md:p-0"
          />
        </div>
      </div>
    </div>
  );
}
