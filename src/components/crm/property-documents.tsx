"use client";

import { Button, Modal, Select } from "@/components/ui";
import type { PropertyDocument } from "@/db/schema";
import {
  DOC_CATEGORIES,
  DOC_DIRECT_MAX_BYTES,
  DOC_EXTENSIONS,
  DOC_MAX_BYTES,
  docExtension,
  formatBytes,
  safeDocName,
  type DocCategory,
} from "@/lib/documents";
import { cn, timeAgo } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderLock,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { upload as blobUpload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

const ACCEPT = Object.keys(DOC_EXTENSIONS)
  .map((e) => `.${e}`)
  .join(",");

function DocIcon({ type }: { type: string }) {
  const Icon = type.startsWith("image/")
    ? FileImage
    : /sheet|excel|csv/.test(type)
      ? FileSpreadsheet
      : FileText;
  return <Icon className="size-4" />;
}

/** Envia um arquivo com progresso real (XHR). */
function upload(propertyId: string, file: File, category: string, onProgress: (p: number) => void) {
  return new Promise<PropertyDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/properties/${propertyId}/documents`);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => {
      let data: PropertyDocument & { error?: string };
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error(`Falha no envio (HTTP ${xhr.status}).`));
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.id) resolve(data);
      else reject(new Error(data.error || `Falha no envio (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Falha de rede no envio."));
    xhr.ontimeout = () => reject(new Error("O envio demorou demais. Tente novamente."));
    const body = new FormData();
    body.append("file", file);
    body.append("category", category);
    xhr.send(body);
  });
}

/**
 * Arquivo acima de 4 MB: vai direto do navegador ao Blob (sem passar pelo
 * limite das funções da Vercel) e depois é registrado no imóvel.
 */
async function uploadDirect(
  propertyId: string,
  file: File,
  category: string,
  onProgress: (p: number) => void,
) {
  const contentType = DOC_EXTENSIONS[docExtension(file.name)];
  const options = {
    handleUploadUrl: `/api/properties/${propertyId}/documents/upload`,
    contentType,
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: ({ percentage }: { percentage: number }) => onProgress(percentage),
  };
  const pathname = `documentos/${propertyId}/${safeDocName(file.name)}`;
  let blob: { pathname: string; url: string };
  let isPublic = false;
  try {
    // Store privado (o normal aqui): o arquivo só sai pelo sistema, com login
    blob = await blobUpload(pathname, file, { ...options, access: "private" });
  } catch (e) {
    if (!(e instanceof Error && /public/i.test(e.message))) throw e;
    blob = await blobUpload(pathname, file, { ...options, access: "public" });
    isPublic = true;
  }
  const res = await fetch(`/api/properties/${propertyId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pathname: blob.pathname,
      url: blob.url,
      public: isPublic,
      name: file.name,
      category,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(data.error || `Falha ao registrar (HTTP ${res.status}).`);
  return data as PropertyDocument;
}

/** Documentos internos do imóvel — visíveis só para a equipe logada. */
export function PropertyDocuments({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: PropertyDocument[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState(initial);
  const [category, setCategory] = useState<DocCategory>("escritura");
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [toDelete, setToDelete] = useState<PropertyDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const href = (d: PropertyDocument, download = false) =>
    `/api/properties/${propertyId}/documents/${d.id}${download ? "?download" : ""}`;

  async function send(files: FileList | File[]) {
    const list = Array.from(files);
    let ok = 0;
    for (const file of list) {
      if (!DOC_EXTENSIONS[docExtension(file.name)]) {
        toast.error(`${file.name}: formato não aceito.`);
        continue;
      }
      if (file.size > DOC_DIRECT_MAX_BYTES) {
        toast.error(`${file.name}: acima de 100 MB. Comprima o arquivo ou divida em partes.`);
        continue;
      }
      try {
        setProgress({ name: file.name, pct: 0 });
        const onProgress = (pct: number) => setProgress({ name: file.name, pct });
        const doc =
          file.size > DOC_MAX_BYTES
            ? await uploadDirect(propertyId, file, category, onProgress)
            : await upload(propertyId, file, category, onProgress);
        setDocs((arr) => [doc, ...arr]);
        ok += 1;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "falha no envio"}`);
      }
    }
    setProgress(null);
    if (ok) {
      toast.success(ok === 1 ? "Documento anexado." : `${ok} documentos anexados.`);
      router.refresh();
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(href(toDelete), { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocs((arr) => arr.filter((d) => d.id !== toDelete.id));
      toast.success("Documento removido.");
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error("Não foi possível remover o documento.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <FolderLock className="size-4 text-subtle" />
            Documentos internos
            <span className="font-mono text-[11px] font-normal text-subtle">{docs.length}</span>
          </h2>
          <p className="mt-1 text-xs text-subtle">
            Escrituras, matrículas, contratos… Só a equipe logada vê — nunca vão para o site,
            a ficha ou os portais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocCategory)}
            className="h-9 w-auto text-xs"
            aria-label="Tipo do documento"
          >
            {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="primary" onClick={() => input.current?.click()} disabled={!!progress}>
            <Paperclip className="size-3.5" />
            Anexar
          </Button>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) send(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Área de soltar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) send(e.dataTransfer.files);
        }}
        className={cn(
          "mt-4 rounded-xl border border-dashed transition-colors",
          dragging ? "border-accent bg-accent/5" : "border-hairline",
        )}
      >
        {progress && (
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 text-xs">
            <Loader2 className="size-4 animate-spin text-subtle" />
            <span className="min-w-0 flex-1 truncate">{progress.name}</span>
            <span className="font-mono tabular text-subtle">{Math.round(progress.pct)}%</span>
          </div>
        )}
        {docs.length === 0 && !progress ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center text-sm text-subtle"
          >
            <Upload className="size-5" />
            Arraste arquivos aqui ou clique para anexar
            <span className="text-[11px]">PDF, imagens, Word, Excel, KMZ ou ZIP · até 100 MB cada</span>
          </button>
        ) : (
          <ul className="divide-y divide-hairline">
            {docs.map((d) => (
              <li key={d.id} className="group flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-soft text-subtle">
                  <DocIcon type={d.contentType} />
                </span>
                <a
                  href={href(d)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1"
                  title="Abrir"
                >
                  <span className="block truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                    {d.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] text-subtle">
                    {DOC_CATEGORIES[d.category as DocCategory] ?? "Outro"} · {formatBytes(d.size)} ·{" "}
                    {timeAgo(d.createdAt)}
                    {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
                  </span>
                </a>
                <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <a href={href(d)} target="_blank" rel="noreferrer" aria-label="Abrir">
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="size-4" />
                    </Button>
                  </a>
                  <a href={href(d, true)} aria-label="Baixar">
                    <Button variant="ghost" size="icon">
                      <Download className="size-4" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setToDelete(d)}>
                    <Trash2 className="size-4 text-red-500/80" />
                  </Button>
                </div>
              </li>
            ))}
            {docs.length > 0 && (
              <li className="px-4 py-2.5 text-center text-[11px] text-subtle">
                Arraste mais arquivos aqui · até 100 MB cada
              </li>
            )}
          </ul>
        )}
      </div>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Remover documento">
        <p className="text-sm leading-relaxed text-subtle">
          Remover <span className="font-medium text-ink">{toDelete?.name}</span>? O arquivo é
          apagado do armazenamento e não pode ser recuperado.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deleting} onClick={confirmDelete}>
            Remover
          </Button>
        </div>
      </Modal>
    </div>
  );
}
