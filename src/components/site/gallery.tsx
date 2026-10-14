"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { lockScroll } from "@/lib/scroll-lock";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Carrossel do celular: foto visível e início do toque (para deslizar no lightbox)
  const [slide, setSlide] = useState(0);
  const touchX = useRef<number | null>(null);

  const show = useCallback(
    (i: number) => setIndex((i + images.length) % images.length),
    [images.length],
  );

  // O lightbox vai para o <body>: dentro do bloco animado (transform), o
  // "fixed" ficaria preso a ele em vez de cobrir a tela
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    return unlock;
  }, [open]);

  // Mantém a miniatura da foto atual visível na faixa
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = strip.current?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    const box = strip.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, index, show]);

  if (!images.length)
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-soft text-subtle">
        Sem fotos cadastradas
      </div>
    );

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  return (
    <>
      {/* Celular: carrossel de deslizar com todas as fotos */}
      <div className="relative lg:hidden">
        <div
          className="-mx-5 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:mx-0 sm:rounded-2xl"
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.map((src, i) => (
            <button
              key={src + i}
              onClick={() => openAt(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-soft"
              aria-label={`Ampliar foto ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i === 0 ? title : `${title} — foto ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 font-mono text-[11px] tabular text-white backdrop-blur-md">
          <Expand className="size-3" />
          {slide + 1} / {images.length}
        </span>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-all",
                  i === Math.min(slide, 7) ? "w-4 bg-white" : "bg-white/50",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden gap-3 lg:grid lg:grid-cols-3">
        <button
          onClick={() => openAt(0)}
          className="group relative aspect-[16/11] overflow-hidden rounded-2xl bg-soft lg:col-span-2 lg:row-span-2 lg:aspect-auto"
          aria-label="Ampliar galeria"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0]}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-md">
            <Expand className="size-3.5" />
            {images.length} fotos
          </span>
        </button>
        {images.slice(1, 3).map((src, i) => (
          <button
            key={src + i}
            onClick={() => openAt(i + 1)}
            className="group relative hidden aspect-[16/10] overflow-hidden rounded-2xl bg-soft lg:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${title} — foto ${i + 2}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.05]"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {mounted &&
        createPortal(
      <div
        data-lenis-prevent
        role="dialog"
        aria-modal
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-[70] flex items-center justify-center bg-black/95 transition-all duration-500",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
        onClick={() => setOpen(false)}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
        }}
      >
        <p className="absolute left-6 top-6 font-mono text-sm tabular text-white/70">
          {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </p>
        <button
          className="absolute right-6 top-6 rounded-full border border-white/20 p-2.5 text-white transition-colors hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="size-5" />
        </button>
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                show(index - 1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 p-3 text-white transition-colors hover:bg-white/10 md:left-8"
              aria-label="Anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                show(index + 1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 p-3 text-white transition-colors hover:bg-white/10 md:right-8"
              aria-label="Próxima"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[index]}
          src={images[index]}
          alt={`${title} — foto ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "animate-fade-in max-w-[92vw] rounded-xl object-contain",
            images.length > 1 ? "max-h-[calc(100dvh-190px)] -translate-y-8 md:-translate-y-10" : "max-h-[86vh]",
          )}
        />
        {/* Miniaturas de todas as fotos */}
        {images.length > 1 && (
          <div
            ref={strip}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-4 mx-auto flex max-w-[min(92vw,1100px)] gap-2 overflow-x-auto px-2 py-1 [scrollbar-width:none] md:bottom-6"
          >
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                data-i={i}
                onClick={() => show(i)}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg transition-all duration-300 first:ml-auto last:mr-auto md:h-16 md:w-24",
                  i === index ? "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-black" : "opacity-45 hover:opacity-80",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>,
          document.body,
        )}
    </>
  );
}
