"use client";

import { Button, Field, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, Copy, Loader2, MessageCircle, PlugZap, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Cfg = {
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
              ? "API oficial da Meta (WhatsApp Cloud API). As mensagens chegam em CRM › WhatsApp e número novo vira lead."
              : cfg?.ready
                ? "Conectado à API oficial — clique para ver ou alterar"
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

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={test} disabled={testing || saving}>
                  {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                  Salvar e testar conexão
                </Button>
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
