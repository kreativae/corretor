"use client";

import { Button, Field, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, Copy, Loader2, LogOut, MessageCircle, PlugZap, QrCode, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Cfg = {
  provider: "evolution" | "meta";
  evolutionUrl: string;
  evolutionKey: string;
  evolutionInstance: string;
  evolutionWebhookUrl: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  autoLead: boolean;
  notify: boolean;
  templateName: string;
  templateLang: string;
  ready: boolean;
  webhookUrl: string;
};

/** WhatsApp Cloud API (Meta): credenciais, webhook e regras de leads. */
export function WhatsAppCard() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/whatsapp/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => undefined);
    // Link direto (#whatsapp) abre o cartão
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (location.hash === "#whatsapp") setOpen(true);
  }, []);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  /* ── Conexão por QR code (Evolution API) ── */
  const [conn, setConn] = useState<{ state: string; number?: string | null; name?: string | null; error?: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pairNumber, setPairNumber] = useState("");
  const [pairCode, setPairCode] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const r = await fetch("/api/whatsapp/evolution/status", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return null;
    const d = await r.json();
    setConn(d);
    if (d.state === "open") {
      setQr(null);
      setPairCode(null);
    }
    return d.state as string;
  }, []);

  useEffect(() => {
    if (!open || cfg?.provider !== "evolution" || !cfg.ready) return;
    const first = window.setTimeout(refreshState, 0);
    // Enquanto o QR está na tela, confere a cada 3 s se o celular já leu
    const t = window.setInterval(refreshState, qr || pairCode ? 3000 : 15000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [open, cfg?.provider, cfg?.ready, qr, pairCode, refreshState]);

  async function connect(byNumber = false) {
    if (byNumber && pairNumber.replace(/\D/g, "").length < 10) {
      toast.error("Informe o número com DDD.");
      return;
    }
    setConnecting(true);
    try {
      await save();
      const res = await fetch("/api/whatsapp/evolution/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(byNumber ? { number: pairNumber } : {}),
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

  async function logout() {
    if (!confirm("Desconectar o WhatsApp do CRM? As conversas salvas continuam no sistema.")) return;
    const res = await fetch("/api/whatsapp/evolution/logout", { method: "POST" });
    if (!res.ok) return toast.error("Não foi possível desconectar.");
    toast.success("WhatsApp desconectado.");
    setQr(null);
    setPairCode(null);
    refreshState();
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCfg(data);
      toast.success("WhatsApp salvo.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await save();
      const res = await fetch("/api/whatsapp/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Conectado: ${data.verified_name} · ${data.display_phone_number}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na conexão.");
    } finally {
      setTesting(false);
    }
  }

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    toast.success("Copiado.");
  };

  return (
    <section id="whatsapp" className="card-elev scroll-mt-24 rounded-2xl border border-hairline bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-6 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <MessageCircle className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            WhatsApp
            {cfg?.ready && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-600">
                <CheckCircle2 className="size-3" /> configurado
              </span>
            )}
          </span>
          <span className={cn("mt-1 block max-w-xl text-xs text-subtle", !open && "truncate")}>
            {open
              ? "Conexão por QR code (Evolution API) ou API oficial da Meta. As mensagens chegam em CRM › WhatsApp e número novo vira lead."
              : cfg?.ready
                ? cfg.provider === "evolution"
                  ? "Conexão por QR code configurada — clique para ver o status"
                  : "Conectado à API oficial — clique para ver ou alterar"
                : "Não conectado — clique para configurar"}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-6 border-t border-hairline p-6">
          {!cfg ? (
            <div className="flex justify-center py-6 text-subtle">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex gap-1 rounded-xl border border-hairline p-1">
                {(
                  [
                    ["evolution", "QR code (Evolution API)"],
                    ["meta", "API oficial da Meta"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("provider", v)}
                    className={cn(
                      "h-9 flex-1 rounded-lg text-xs font-medium transition-colors",
                      cfg.provider === v ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {cfg.provider === "evolution" ? (
                <div className="space-y-5">
                  <p className="text-xs leading-relaxed text-subtle">
                    Conecta o número atual lendo um QR code, como o WhatsApp Web. Precisa de um servidor da{" "}
                    <span className="font-medium text-ink">Evolution API</span> (gratuita) — veja o guia em{" "}
                    <code className="font-mono">docs/evolution-api.md</code>.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-[1fr_1fr_160px]">
                    <Field label="Endereço do servidor">
                      <Input value={cfg.evolutionUrl} onChange={(e) => set("evolutionUrl", e.target.value)} className="font-mono text-xs" placeholder="https://evolution.seudominio.com" />
                    </Field>
                    <Field label="Chave da API (AUTHENTICATION_API_KEY)">
                      <Input
                        value={cfg.evolutionKey}
                        onFocus={() => cfg.evolutionKey.includes("•") && set("evolutionKey", "")}
                        onChange={(e) => set("evolutionKey", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </Field>
                    <Field label="Instância">
                      <Input value={cfg.evolutionInstance} onChange={(e) => set("evolutionInstance", e.target.value)} className="font-mono text-xs" placeholder="corretor" />
                    </Field>
                  </div>

                  {/* Conexão */}
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
                            <li>Abra o WhatsApp no celular do número da imobiliária</li>
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
                          <p className="text-xs text-subtle">
                            {conn?.state === "error" ? conn.error : "Salve os dados do servidor e gere o QR code."}
                          </p>
                        </div>
                        <Button variant="accent" size="sm" onClick={() => connect()} disabled={connecting || !cfg.evolutionUrl}>
                          {connecting ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                          Conectar com QR code
                        </Button>
                      </div>
                    )}
                    {conn?.state !== "open" && !pairCode && (
                      <div className="mt-4 border-t border-hairline pt-4">
                        <p className="text-xs text-subtle">Ou conecte sem QR: número do WhatsApp da imobiliária</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Input
                            value={pairNumber}
                            onChange={(e) => setPairNumber(e.target.value)}
                            inputMode="tel"
                            placeholder="(62) 99999-9999"
                            className="max-w-[14rem]"
                          />
                          <Button variant="outline" size="sm" onClick={() => connect(true)} disabled={connecting || !cfg.evolutionUrl}>
                            {connecting ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                            Gerar código
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-subtle">
                    O webhook é configurado sozinho ao conectar (
                    <button type="button" onClick={() => copy(cfg.evolutionWebhookUrl)} className="underline underline-offset-2">
                      copiar URL
                    </button>
                    ). Não é a API oficial: use para atendimento, sem disparos em massa.
                  </p>
                </div>
              ) : (
              <>
              <ol className="list-decimal space-y-1.5 rounded-xl bg-soft p-4 pl-8 text-xs leading-relaxed text-subtle">
                <li>
                  Em <span className="font-medium text-ink">developers.facebook.com</span>, crie um app do tipo{" "}
                  <span className="font-medium text-ink">Business</span> e adicione o produto{" "}
                  <span className="font-medium text-ink">WhatsApp</span>.
                </li>
                <li>Em WhatsApp › Configuração da API, copie o <b>ID do número de telefone</b> e o <b>ID da conta (WABA)</b>.</li>
                <li>
                  Gere um <b>token permanente</b> (Configurações do negócio › Usuários do sistema, com as permissões{" "}
                  <code className="font-mono">whatsapp_business_messaging</code> e{" "}
                  <code className="font-mono">whatsapp_business_management</code>).
                </li>
                <li>Em Configurações do app › Básico, copie a <b>Chave secreta do app</b>.</li>
                <li>
                  Em WhatsApp › Configuração › Webhook, cole a <b>URL</b> e o <b>token de verificação</b> abaixo e assine o
                  campo <code className="font-mono">messages</code>.
                </li>
              </ol>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ID do número de telefone">
                  <Input value={cfg.phoneNumberId} onChange={(e) => set("phoneNumberId", e.target.value)} className="font-mono" placeholder="1234567890" />
                </Field>
                <Field label="ID da conta do WhatsApp Business (WABA)" hint="Opcional">
                  <Input value={cfg.wabaId} onChange={(e) => set("wabaId", e.target.value)} className="font-mono" />
                </Field>
                <Field label="Token de acesso (permanente)" hint="Fica só no servidor. Em branco mantém o atual.">
                  <Input
                    value={cfg.accessToken}
                    onFocus={() => cfg.accessToken.includes("•") && set("accessToken", "")}
                    onChange={(e) => set("accessToken", e.target.value)}
                    className="font-mono"
                    placeholder="EAAG…"
                  />
                </Field>
                <Field label="Chave secreta do app (App Secret)" hint="Confere a assinatura das mensagens recebidas">
                  <Input
                    value={cfg.appSecret}
                    onFocus={() => cfg.appSecret.includes("•") && set("appSecret", "")}
                    onChange={(e) => set("appSecret", e.target.value)}
                    className="font-mono"
                  />
                </Field>
              </div>

              <div className="grid gap-4 rounded-xl border border-hairline p-4 sm:grid-cols-2">
                <Field label="URL do webhook (cole na Meta)">
                  <div className="flex gap-2">
                    <Input readOnly value={cfg.webhookUrl} className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" onClick={() => copy(cfg.webhookUrl)} aria-label="Copiar URL">
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </Field>
                <Field label="Token de verificação (cole na Meta)" hint="Gerado ao salvar; pode trocar">
                  <div className="flex gap-2">
                    <Input value={cfg.verifyToken} onChange={(e) => set("verifyToken", e.target.value)} className="font-mono text-xs" placeholder="gerado ao salvar" />
                    <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" onClick={() => copy(cfg.verifyToken)} disabled={!cfg.verifyToken} aria-label="Copiar token">
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </Field>
              </div>

              </>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start justify-between gap-4 rounded-xl border border-hairline p-4">
                  <span>
                    <span className="block text-sm font-medium">Criar lead automaticamente</span>
                    <span className="mt-0.5 block text-xs text-subtle">Número que não está no CRM vira lead com a primeira mensagem.</span>
                  </span>
                  <Switch checked={cfg.autoLead} onChange={(v) => set("autoLead", v)} />
                </label>
                <label className="flex items-start justify-between gap-4 rounded-xl border border-hairline p-4">
                  <span>
                    <span className="block text-sm font-medium">Avisar a equipe por e-mail</span>
                    <span className="mt-0.5 block text-xs text-subtle">Usa os destinatários de &quot;Avisos de novos leads&quot;.</span>
                  </span>
                  <Switch checked={cfg.notify} onChange={(v) => set("notify", v)} />
                </label>
              </div>

              {cfg.provider === "meta" && (
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field
                  label="Modelo para reabrir conversa (opcional)"
                  hint="Nome de um modelo aprovado na Meta, sem variáveis. Usado quando passaram 24 h da última mensagem do cliente."
                >
                  <Input value={cfg.templateName} onChange={(e) => set("templateName", e.target.value)} className="font-mono" placeholder="retomar_contato" />
                </Field>
                <Field label="Idioma">
                  <Input value={cfg.templateLang} onChange={(e) => set("templateLang", e.target.value)} className="font-mono" placeholder="pt_BR" />
                </Field>
              </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {cfg.provider === "meta" && (
                <Button variant="outline" onClick={test} disabled={testing || saving}>
                  {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                  Salvar e testar conexão
                </Button>
                )}
                <Button variant="accent" onClick={save} loading={saving}>
                  <Save className="size-4" />
                  Salvar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
