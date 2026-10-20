"use client";

import { Button } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { Check, Copy, ExternalLink, Inbox, Loader2, RefreshCw, Rss } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Info = {
  feedUrl: string;
  leadsUrl: string;
  feedReadAt: string | null;
  feedReader: string | null;
  leadAt: string | null;
  leadCount: number;
};

const CANAL_PRO = "https://canalpro.grupozap.com";

/**
 * Conexão com ZAP Imóveis, Viva Real e OLX (Grupo OLX), feita uma vez no Canal Pro:
 * o portal lê o feed de anúncios e manda os leads de volta para o CRM.
 */
export function PortalConnect({ compact }: { compact?: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    fetch("/api/portals/connect")
      .then(async (r) => (r.ok ? setInfo(await r.json()) : setError(r.status === 403 ? "admin" : "erro")))
      .catch(() => setError("erro"));
  }, []);

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function rotate() {
    if (!confirm("Gerar um novo endereço de leads? O antigo para de funcionar e precisa ser trocado no Canal Pro.")) return;
    setRotating(true);
    try {
      const r = await fetch("/api/portals/connect", { method: "POST" });
      if (!r.ok) throw new Error();
      setInfo(await r.json());
      toast.success("Novo endereço gerado. Atualize no Canal Pro.");
    } catch {
      toast.error("Não foi possível gerar.");
    } finally {
      setRotating(false);
    }
  }

  if (error === "admin") {
    return <p className="rounded-xl bg-soft p-4 text-xs text-subtle">A conexão com os portais é feita por um administrador.</p>;
  }
  if (!info) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-soft p-4 text-xs text-subtle">
        {error ? "Não foi possível carregar a conexão com os portais." : <><Loader2 className="size-3.5 animate-spin" /> Carregando conexão…</>}
      </p>
    );
  }

  const urlRow = (id: string, url: string) => (
    <div className="flex items-center gap-2 rounded-xl bg-soft px-3.5 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-subtle">{url}</code>
      <Button size="sm" variant="outline" onClick={() => void copy(url, id)} className="shrink-0">
        {copied === id ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
        Copiar
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">ZAP Imóveis · Viva Real · OLX</p>
          <p className="mt-0.5 text-xs text-subtle">
            Os três são do Grupo OLX e se conectam juntos, uma vez só, pelo Canal Pro.
          </p>
        </div>
        <a href={CANAL_PRO} target="_blank" rel="noreferrer">
          <Button size="sm" variant="accent">
            <ExternalLink className="size-3.5" />
            Abrir Canal Pro
          </Button>
        </a>
      </div>

      {/* Situação real da conexão */}
      <div className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
        <div className="flex items-center gap-2.5 rounded-xl border border-hairline p-3 text-xs">
          <Rss className={cn("size-4 shrink-0", info.feedReadAt ? "text-emerald-500" : "text-subtle")} />
          <span className="min-w-0">
            <span className="block font-medium">{info.feedReadAt ? "Anúncios conectados" : "Anúncios: aguardando o portal"}</span>
            <span className="block text-subtle">
              {info.feedReadAt
                ? `Feed lido ${timeAgo(new Date(info.feedReadAt))} · ${info.feedReader}`
                : "Ainda nenhum portal leu o feed"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-hairline p-3 text-xs">
          <Inbox className={cn("size-4 shrink-0", info.leadAt ? "text-emerald-500" : "text-subtle")} />
          <span className="min-w-0">
            <span className="block font-medium">{info.leadAt ? "Leads conectados" : "Leads: aguardando o portal"}</span>
            <span className="block text-subtle">
              {info.leadAt
                ? `${info.leadCount} recebido${info.leadCount === 1 ? "" : "s"} · último ${timeAgo(new Date(info.leadAt))}`
                : "Nenhum lead recebido ainda"}
            </span>
          </span>
        </div>
      </div>

      <ol className="space-y-4 text-xs">
        <li>
          <p className="mb-1.5 font-medium">
            1. Anúncios: no Canal Pro, na área de <strong>integração de anúncios (XML)</strong>, cole o endereço do feed
          </p>
          {urlRow("feed", info.feedUrl)}
          <p className="mt-1.5 text-subtle">
            O portal busca o feed sozinho, várias vezes ao dia. Entram os anúncios marcados como &quot;Visível no site&quot;,
            com fotos originais, preço, medidas e bairro (o endereço completo fica oculto no portal). O formato é o VRSync,
            aceito também por outros portais.
          </p>
        </li>
        <li>
          <p className="mb-1.5 font-medium">
            2. Leads: na área de <strong>integração de leads</strong>, cole este endereço
          </p>
          {urlRow("leads", info.leadsUrl)}
          <p className="mt-1.5 text-subtle">
            Cada contato feito no ZAP, Viva Real ou OLX vira lead no CRM (origem Portal), com negociação aberta no anúncio
            pelo código e aviso por e-mail. O endereço é secreto: não compartilhe.{" "}
            <button type="button" onClick={() => void rotate()} disabled={rotating} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink">
              <RefreshCw className={cn("size-3", rotating && "animate-spin")} />
              Gerar novo endereço
            </button>
          </p>
        </li>
      </ol>
      <p className="text-[11px] text-subtle">
        Não achou essas opções? O suporte do Canal Pro ativa a integração por XML e de leads; é só enviar os dois endereços.
        A quantidade de anúncios publicados segue o seu plano no portal.
      </p>
    </div>
  );
}
