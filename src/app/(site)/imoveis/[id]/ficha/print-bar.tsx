"use client";

import type { RuralData } from "@/lib/rural";
import { MAX_UPLOAD_BYTES, sendFile } from "@/lib/upload-client";
import { ArrowLeft, Loader2, MapPinned, Printer, Share2 } from "lucide-react";
import { buildFichaPdf, downloadFile } from "./share-pdf";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * A ficha costuma abrir em nova aba (sem histórico). "Voltar" então fecha a
 * aba; se o navegador não permitir, vai para a página do imóvel.
 */
export function PrintBar({
  backHref,
  kmz,
  share,
}: {
  backHref: string;
  /** Dados para compartilhar o PDF */
  share: { fileName: string; title: string; text: string; url: string };
  /** Propriedade rural com usuário logado: permite anexar/trocar o KMZ daqui */
  kmz?: { propertyId: string; type: string; rural: RuralData };
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  async function sharePdf() {
    setSharing(true);
    try {
      const file = await buildFichaPdf(share.fileName);
      const data: ShareData = { files: [file], title: share.title, text: `${share.text}\n${share.url}` };
      if (navigator.canShare?.(data)) {
        try {
          await navigator.share(data);
        } catch (e) {
          // Usuário fechou a janela de compartilhar: não é erro
          if (e instanceof DOMException && e.name === "AbortError") return;
          throw e;
        }
      } else {
        downloadFile(file);
        toast.success("PDF baixado — anexe na conversa ou no e-mail.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF. Use Imprimir › Salvar como PDF.");
    } finally {
      setSharing(false);
    }
  }

  function goBack() {
    const sameOriginReferrer =
      document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (window.history.length > 1 && sameOriginReferrer) {
      router.back();
      return;
    }
    window.close();
    // Se a aba não pôde ser fechada, segue para o imóvel
    setTimeout(() => router.push(backHref), 150);
  }

  async function attachKmz(file: File) {
    if (!kmz) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "kmz" && ext !== "kml") {
      toast.error("Envie um arquivo .kmz ou .kml (Google Earth).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Arquivo acima de 4 MB.");
      return;
    }
    setProgress(0);
    try {
      const url = await sendFile(file, setProgress, "kmz");
      const res = await fetch(`/api/properties/${kmz.propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kmz.type,
          rural: { ...kmz.rural, kmzUrl: url, kmzName: file.name },
        }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar o KMZ na propriedade.");
      toast.success("KMZ anexado — QR code de download adicionado à ficha.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setProgress(null);
    }
  }

  const btn =
    "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-xl transition-transform hover:scale-[1.03] disabled:opacity-70 sm:px-5";

  return (
    <div className="no-print fixed inset-x-0 bottom-4 z-50 flex flex-wrap items-center justify-center gap-2 px-3 pb-[env(safe-area-inset-bottom)] sm:bottom-6">
      <button onClick={goBack} className={`${btn} bg-neutral-900 text-white`} aria-label="Voltar">
        <ArrowLeft className="size-4" />
        <span className="hidden sm:inline">Voltar</span>
      </button>
      {kmz && (
        <>
          <button
            onClick={() => input.current?.click()}
            disabled={progress !== null}
            className={`${btn} bg-white text-neutral-900 disabled:opacity-70`}
          >
            {progress !== null ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando {Math.round(progress)}%
              </>
            ) : (
              <>
                <MapPinned className="size-4" />
                {kmz.rural.kmzUrl ? "Trocar KMZ" : "Anexar KMZ"}
              </>
            )}
          </button>
          <input
            ref={input}
            type="file"
            accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void attachKmz(f);
              e.target.value = "";
            }}
          />
        </>
      )}
      <button
        onClick={() => window.print()}
        className={`${btn} bg-white text-neutral-900`}
        aria-label="Imprimir"
      >
        <Printer className="size-4" />
        <span className="hidden sm:inline">Imprimir</span>
      </button>
      {/* Foco: compartilhar o PDF */}
      <button
        onClick={sharePdf}
        disabled={sharing}
        className={`${btn} h-12 bg-emerald-500 px-6 text-[15px] font-semibold text-neutral-950 ring-4 ring-emerald-500/25 sm:px-7`}
      >
        {sharing ? <Loader2 className="size-4.5 animate-spin" /> : <Share2 className="size-4.5" />}
        {sharing ? "Gerando PDF…" : "Compartilhar PDF"}
      </button>
    </div>
  );
}
