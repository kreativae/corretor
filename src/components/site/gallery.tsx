"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const show = useCallback(
    (i: number) => setIndex((i + images.length) % images.length),
    [images.length],
  );

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
      <div className="grid gap-3 lg:grid-cols-3">
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
      <div
        className={cn(
          "fixed inset-0 z-[70] flex items-center justify-center bg-black/95 transition-all duration-500",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
        onClick={() => setOpen(false)}
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
          className="animate-fade-in max-h-[86vh] max-w-[92vw] rounded-xl object-contain"
        />
      </div>
    </>
  );
}
