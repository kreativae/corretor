"use client";

import { Button, Input, Modal } from "@/components/ui";
import { focusOf, focusValue, type ImageFocus } from "@/lib/image-focus";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Crosshair, ImagePlus, Link2, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { compressImage, MAX_UPLOAD_BYTES, sendFile } from "@/lib/upload-client";

type Pending = { id: string; name: string; progress: number };

/** Galeria do anúncio: upload, URL externa, capa, ordem e remoção. */
export function PhotoManager({
  images,
  onChange,
  focus = {},
  onFocusChange,
}: {
  images: string[];
  onChange: (next: string[] | ((cur: string[]) => string[])) => void;
  /** Ponto de foco de cada foto (onde o corte se centra no site) */
  focus?: ImageFocus;
  onFocusChange?: (next: ImageFocus) => void;
}) {
  const [focusing, setFocusing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      toast.error("Selecione arquivos de imagem (JPG, PNG ou WebP).");
      return;
    }
    // Envia em sequência para manter a ordem escolhida
    for (const file of list) {
      const id = crypto.randomUUID();
      setPending((p) => [...p, { id, name: file.name, progress: 0 }]);
      try {
        const ready = await compressImage(file);
        if (ready.size > MAX_UPLOAD_BYTES) throw new Error("Arquivo acima de 4 MB mesmo após compressão.");
        const url = await sendFile(ready, (pct) =>
          setPending((p) => p.map((x) => (x.id === id ? { ...x, progress: pct } : x))),
        );
        onChange((cur) => [...cur, url]);
      } catch (e) {
        const reason = e instanceof Error && e.message ? e.message : "falha no envio";
        toast.error(`${file.name}: ${reason}`);
      } finally {
        setPending((p) => p.filter((x) => x.id !== id));
      }
    }
  }

  function addUrl() {
    const v = url.trim();
    if (!/^https?:\/\//.test(v)) {
      toast.error("Informe uma URL começando com https://");
      return;
    }
    onChange((cur) => [...cur, v]);
    setUrl("");
  }

  function move(from: number, to: number) {
    onChange((cur) => {
      if (to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline-strong px-4 py-8 text-center transition-colors hover:bg-soft",
          dragging && "border-accent bg-soft",
        )}
      >
        <ImagePlus className="size-6 text-subtle" />
        <p className="text-sm font-medium">Arraste fotos aqui ou clique para anexar</p>
        <p className="text-xs text-subtle">JPG, PNG ou WebP · reduzidas automaticamente antes do envio</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {(images.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-hairline bg-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="size-full object-cover" style={{ objectPosition: focusOf(focus, src) }} />
              {onFocusChange && (
                <button
                  type="button"
                  onClick={() => setFocusing(src)}
                  title="Ponto de foco: o que não pode ser cortado"
                  className={cn(
                    "absolute right-11 top-2 flex h-7 items-center gap-1 rounded-full px-2 text-[11px] text-white transition-opacity sm:opacity-0 sm:group-hover:opacity-100",
                    focus[src] ? "bg-accent sm:opacity-100" : "bg-black/60",
                  )}
                >
                  <Crosshair className="size-3.5" />
                  Foco
                </button>
              )}
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-accent">
                  Capa
                </span>
              )}
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => onChange((cur) => cur.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Mover para a esquerda"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, 0)}
                    className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 text-[11px] text-white"
                  >
                    <Star className="size-3" />
                    Capa
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Mover para a direita"
                  disabled={i === images.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-soft px-3 text-center"
            >
              <Loader2 className="size-5 animate-spin text-subtle" />
              <span className="w-full truncate text-[11px] text-subtle">{p.name}</span>
              <span className="font-mono text-[11px] tabular">{Math.round(p.progress)}%</span>
            </div>
          ))}
        </div>
      )}

      {onFocusChange && (
        <FocusPicker
          src={focusing}
          value={focusing ? focusOf(focus, focusing) : undefined}
          onClose={() => setFocusing(null)}
          onSave={(v) => {
            if (!focusing) return;
            const next = { ...focus };
            if (v) next[focusing] = v;
            else delete next[focusing];
            onFocusChange(next);
            setFocusing(null);
          }}
        />
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="Ou cole o link de uma imagem"
            className="pl-8 text-xs"
          />
        </div>
        <Button type="button" variant="outline" onClick={addUrl}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

/**
 * Escolha do ponto de foco: clique na foto inteira e veja como ficam os cortes da capa
 * (larga) e do card (4:3).
 */
function FocusPicker({
  src,
  value,
  onClose,
  onSave,
}: {
  src: string | null;
  value: string | undefined;
  onClose: () => void;
  onSave: (v: string | undefined) => void;
}) {
  const [point, setPoint] = useState<string | undefined>(value);
  const [seen, setSeen] = useState(src);
  if (seen !== src) {
    setSeen(src);
    setPoint(value);
  }
  const [px, py] = (point ?? "50% 50%").split(" ").map((v) => parseFloat(v));
  return (
    <Modal open={!!src} onClose={onClose} title="Ponto de foco da foto">
      {src && (
        <div className="space-y-4">
          <p className="text-xs text-subtle">
            Clique no que não pode ser cortado (a casa, a fachada, a vista). Nas fotos cortadas do site, esse ponto fica sempre visível.
          </p>
          <div
            className="relative cursor-crosshair overflow-hidden rounded-xl bg-soft"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPoint(focusValue(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="block w-full select-none" draggable={false} />
            <span
              className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/60 shadow-lg ring-2 ring-black/30"
              style={{ left: `${px}%`, top: `${py}%` }}
            />
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <figure>
              <div className="aspect-[2/1] overflow-hidden rounded-lg bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: point }} />
              </div>
              <figcaption className="mt-1 text-[11px] text-subtle">Capa do anúncio</figcaption>
            </figure>
            <figure>
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: point }} />
              </div>
              <figcaption className="mt-1 text-[11px] text-subtle">Card nas listas</figcaption>
            </figure>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setPoint(undefined)}>
              Voltar ao centro
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" variant="accent" onClick={() => onSave(point === "50% 50%" ? undefined : point)}>
                Usar este ponto
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

