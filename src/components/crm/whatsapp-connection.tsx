"use client";

import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CheckCircle2, History, Loader2, LogOut, PlugZap, QrCode, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type ConnState = { state: string; number?: string | null; name?: string | null; error?: string };

/**
 * Conexão por QR code (Evolution API) de uma linha: o número principal da
 * empresa (line="main", em Configurações) ou o número de quem está logado.
 */
export function WhatsAppConnection({
  line,
  enabled = true,
  canConnect = true,
  beforeConnect,
  whose = "da imobiliária",
  idleHint = "Gere o QR code e leia com o celular.",
  onState,
}: {
  line?: "main";
  /** Confere o estado (desligado com o cartão fechado ou sem servidor) */
  enabled?: boolean;
  canConnect?: boolean;
  /** Ex.: salvar os dados do servidor antes de gerar o QR */
  beforeConnect?: () => Promise<void>;
  /** "da imobiliária" · "do seu número" — usado nas instruções */
  whose?: string;
  idleHint?: string;
  onState?: (s: ConnState) => void;
}) {
  const [conn, setConn] = useState<ConnState | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pairNumber, setPairNumber] = useState("");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [rescuing, setRescuing] = useState(false);

  const refreshState = useCallback(async () => {
    const r = await fetch(`/api/whatsapp/evolution/status${line ? `?line=${line}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return null;
    const d = (await r.json()) as ConnState;
    setConn(d);
    onState?.(d);
    if (d.state === "open") {
      setQr(null);
      setPairCode(null);
    }
    return d.state;
  }, [line, onState]);

  useEffect(() => {
    if (!enabled) return;
    const first = window.setTimeout(refreshState, 0);
    // Enquanto o QR está na tela, confere a cada 3 s se o celular já leu
    const t = window.setInterval(refreshState, qr || pairCode ? 3000 : 15000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [enabled, qr, pairCode, refreshState]);

  async function connect(byNumber = false) {
    if (byNumber && pairNumber.replace(/\D/g, "").length < 10) {
      toast.error("Informe o número com DDD.");
      return;
    }
    setConnecting(true);
    try {
      await beforeConnect?.();
      const res = await fetch("/api/whatsapp/evolution/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line, ...(byNumber ? { number: pairNumber } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.state === "open") {
        toast.success("WhatsApp já está conectado.");
        refreshState();
      } else if (byNumber) {
        if (!data.pairingCode) throw new Error("O servidor não devolveu o código. Tente de novo em alguns segundos.");
        setPairCode(data.pairingCode);
        setQr(null);
        setConn({ state: "connecting" });
      } else if (data.qr) {
        setPairCode(null);
        setQr(data.qr);
        setConn({ state: "connecting" });
      } else {
        toast.error("O servidor não devolveu o QR code. Tente de novo em alguns segundos.");
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha ao conectar.");
    } finally {
      setConnecting(false);
    }
  }

  /** Traz as mensagens que a Evolution recebeu e não chegaram ao CRM (ex.: enquanto estava desconectado) */
  async function rescue() {
    setRescuing(true);
    try {
      const res = await fetch("/api/whatsapp/evolution/resgatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line, days: 7 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.found
          ? `${data.found} mensagens dos últimos 7 dias conferidas; as que faltavam entraram nas conversas.`
          : "Nenhuma mensagem dos últimos 7 dias no servidor do WhatsApp.",
      );
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível buscar as mensagens.");
    } finally {
      setRescuing(false);
    }
  }

  async function logout() {
    if (!confirm("Desconectar o WhatsApp do CRM? As conversas salvas continuam no sistema.")) return;
    const res = await fetch("/api/whatsapp/evolution/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line }),
    });
    if (!res.ok) return toast.error("Não foi possível desconectar.");
    toast.success("WhatsApp desconectado.");
    setQr(null);
    setPairCode(null);
    refreshState();
  }

  return (
    <div className="rounded-2xl border border-hairline p-5">
      {conn?.state === "open" ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Conectado</p>
            <p className="text-xs text-subtle">
              {[conn.name, conn.number && `+${conn.number}`].filter(Boolean).join(" · ") || "WhatsApp ativo"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={rescue} disabled={rescuing}>
            {rescuing ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
            Buscar mensagens perdidas
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            Desconectar
          </Button>
        </div>
      ) : pairCode ? (
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-sm font-semibold">Digite este código no celular</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.25em]">
            {pairCode.length === 8 ? `${pairCode.slice(0, 4)}-${pairCode.slice(4)}` : pairCode}
          </p>
          <p className="text-xs text-subtle">
            WhatsApp › ⋮ (ou Configurações) › Dispositivos conectados › Conectar um dispositivo › Conectar com número de telefone
          </p>
          <p className="flex items-center justify-center gap-1.5 text-xs text-subtle sm:justify-start">
            <Loader2 className="size-3.5 animate-spin" /> Aguardando a confirmação…
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button variant="outline" size="sm" onClick={() => connect(true)} disabled={connecting}>
              <RefreshCw className={cn("size-4", connecting && "animate-spin")} />
              Gerar outro código
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPairCode(null)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : qr ? (
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code do WhatsApp" className="size-56 rounded-xl bg-white p-2" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Leia com o celular</p>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-subtle">
              <li>Abra o WhatsApp no celular {whose}</li>
              <li>Toque em ⋮ (ou Configurações) › Dispositivos conectados</li>
              <li>Conectar um dispositivo e aponte para este QR code</li>
            </ol>
            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <Loader2 className="size-3.5 animate-spin" /> Aguardando a leitura…
            </p>
            <Button variant="outline" size="sm" onClick={() => connect()} disabled={connecting}>
              <RefreshCw className={cn("size-4", connecting && "animate-spin")} />
              Gerar outro QR
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-soft text-subtle">
            <QrCode className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Desconectado</p>
            <p className="text-xs text-subtle">{conn?.state === "error" ? conn.error : idleHint}</p>
          </div>
          <Button variant="accent" size="sm" onClick={() => connect()} disabled={connecting || !canConnect}>
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
            Conectar com QR code
          </Button>
        </div>
      )}
      {conn?.state !== "open" && !pairCode && (
        <div className="mt-4 border-t border-hairline pt-4">
          <p className="text-xs text-subtle">Ou conecte sem QR: número do WhatsApp {whose}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              value={pairNumber}
              onChange={(e) => setPairNumber(e.target.value)}
              inputMode="tel"
              placeholder="(62) 99999-9999"
              className="max-w-[14rem]"
            />
            <Button variant="outline" size="sm" onClick={() => connect(true)} disabled={connecting || !canConnect}>
              {connecting ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Gerar código
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
