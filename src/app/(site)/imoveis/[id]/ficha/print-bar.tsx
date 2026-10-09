"use client";

import type { RuralData } from "@/lib/rural";
import { MAX_UPLOAD_BYTES, sendFile } from "@/lib/upload-client";
import { ArrowLeft, Loader2, MapPinned, Printer } from "lucide-react";
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
}: {
  backHref: string;
  /** Propriedade rural com usuário logado: permite anexar/trocar o KMZ daqui */
  kmz?: { propertyId: string; type: string; rural: RuralData };
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

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
    "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium shadow-xl transition-transform hover:scale-[1.03]";

  return (
    <div className="no-print fixed inset-x-0 bottom-6 z-50 flex flex-wrap justify-center gap-2 px-4">
      <button onClick={goBack} className={`${btn} bg-neutral-900 text-white`}>
        <ArrowLeft className="size-4" />
        Voltar
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
        className={`${btn} bg-emerald-500 px-6 font-semibold text-neutral-950`}
      >
        <Printer className="size-4" />
        Imprimir / Salvar PDF
      </button>
    </div>
  );
}
