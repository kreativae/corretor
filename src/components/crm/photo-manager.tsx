"use client";

import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { upload } from "@vercel/blob/client";
import { ChevronLeft, ChevronRight, ImagePlus, Link2, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Pending = { id: string; name: string; progress: number };

const MAX_SIDE = 2560;

/**
 * Reduz a foto no navegador antes do envio (lado maior ≤ 2560 px, WebP 85%).
 * Fotos de câmera caem de ~10 MB para < 1 MB. Mantém o original se não ganhar.
 */
async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Galeria do anúncio: upload, URL externa, capa, ordem e remoção. */
export function PhotoManager({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[] | ((cur: string[]) => string[])) => void;
}) {
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
        const ext = ready.name.split(".").pop()?.toLowerCase() || "jpg";
        const blob = await upload(`imoveis/foto.${ext}`, ready, {
          access: "public",
          handleUploadUrl: "/api/uploads",
          multipart: ready.size > 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) =>
            setPending((p) => p.map((x) => (x.id === id ? { ...x, progress: percentage } : x))),
        });
        onChange((cur) => [...cur, blob.url]);
      } catch (e) {
        // O erro do Blob é genérico; pergunta ao servidor o motivo real
        const diag = await fetch("/api/uploads")
          .then((r) => r.json())
          .catch(() => null);
        const reason =
          diag && !diag.ok && diag.error
            ? diag.error
            : e instanceof Error && e.message
              ? e.message
              : "falha no envio";
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
        <p className="text-xs text-subtle">JPG, PNG ou WebP · até 20 MB cada</p>
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
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
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
