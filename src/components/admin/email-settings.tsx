"use client";

import { Button, Field, Input, Switch } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Cfg = {
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  hasKey: boolean;
  webhookSecret: string;
  mailboxEnabled: boolean;
  inboundUrl: string;
  usersWithMailbox: number;
  lastReceivedAt: string | null;
};

type Check = {
  fullAccess: boolean;
  error?: string;
  readReceived?: boolean;
  domainName?: string;
  domain: null | {
    status: string;
    sending: string | null;
    receiving: string | null;
    openTracking: boolean;
    clickTracking: boolean;
    records: { record: string; type: string; name: string; status: string }[];
  };
};

const RECORD_LABEL: Record<string, string> = {
  SPF: "Envio (SPF/MX do subdomínio)",
  DKIM: "Assinatura (DKIM)",
  Receiving: "Recebimento (MX)",
  Tracking: "Rastreamento (CNAME)",
  TrackingCAA: "Rastreamento (CAA)",
};

/** Item da lista do que é necessário: ok, pendente ou atenção */
function Step({ state, title, children }: { state: "ok" | "todo" | "warn" | "fail"; title: string; children?: ReactNode }) {
  const icon = {
    ok: <CheckCircle2 className="size-4 text-emerald-600" />,
    todo: <Circle className="size-4 text-subtle" />,
    warn: <AlertTriangle className="size-4 text-amber-600" />,
    fail: <XCircle className="size-4 text-red-600" />,
  }[state];
  return (
    <li className="flex gap-3 py-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="mt-1 text-xs leading-relaxed text-subtle">{children}</div>}
      </div>
    </li>
  );
}

function Section({ title, subtitle, icon, right, children }: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold tracking-tight">{title}</p>
          <p className="mt-1 text-xs text-subtle">{subtitle}</p>
        </div>
        {right}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function EmailSettings() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);

  useEffect(() => {
    fetch("/api/email-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function post(body: Partial<Cfg>) {
    const res = await fetch("/api/email-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    setCfg((c) => (c ? { ...c, ...d } : c));
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      await post({
        resendApiKey: cfg.resendApiKey,
        fromEmail: cfg.fromEmail,
        fromName: cfg.fromName,
        webhookSecret: cfg.webhookSecret,
      });
      toast.success("Configurações de e-mail salvas.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(v: boolean) {
    set("mailboxEnabled", v);
    setToggling(true);
    try {
      await post({ mailboxEnabled: v });
      toast.success(v ? "Caixa de e-mail ativada. O menu E-mail aparece no CRM." : "Caixa de e-mail desativada.");
    } catch {
      set("mailboxEnabled", !v);
      toast.error("Não foi possível salvar.");
    } finally {
      setToggling(false);
    }
  }

  async function runCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/email-config/check", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCheck(d);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha ao verificar.");
    } finally {
      setChecking(false);
    }
  }

  if (!cfg) {
    return (
      <div className="flex justify-center py-16 text-subtle">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const domain = cfg.fromEmail.split("@")[1] ?? "";
  const d = check?.domain;
  const tracking = d && (d.openTracking || d.clickTracking);

  return (
    <div className="space-y-6">
      {/* Conta de envio */}
      <Section
        title="Conta de envio (Resend)"
        subtitle="Usada pelos avisos de novos leads, pela Negociação e pela caixa de e-mail dos usuários."
        icon={<Send className="size-5" />}
        right={
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              cfg.hasKey ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
            )}
          >
            {cfg.hasKey ? "Configurada" : "Falta a chave"}
          </span>
        }
      >
        <div className="space-y-4">
          <Field
            label="API Key"
            hint="Em resend.com › API Keys. Só para avisos e Negociação basta “Sending access”; a caixa de e-mail precisa de “Full access”. Para remover, digite um hífen (-) e salve."
          >
            <Input
              value={cfg.resendApiKey}
              onChange={(e) => set("resendApiKey", e.target.value)}
              placeholder="re_…"
              className="font-mono text-xs"
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail do remetente" hint="De um domínio verificado no Resend. Vazio = remetente de testes.">
              <Input
                type="email"
                value={cfg.fromEmail}
                onChange={(e) => set("fromEmail", e.target.value)}
                placeholder="contato@suaimobiliaria.com.br"
              />
            </Field>
            <Field label="Nome do remetente" hint="Vazio = nome da imobiliária.">
              <Input value={cfg.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Carlos Amâncio Imóveis" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button variant="accent" loading={saving} onClick={save}>
              <Check className="size-4" />
              Salvar
            </Button>
          </div>
        </div>
      </Section>

      {/* Caixa de e-mail */}
      <Section
        title="Caixa de e-mail dos usuários"
        subtitle={
          domain
            ? `Cada usuário envia e recebe pelo menu E-mail com um endereço @${domain}.`
            : "Cada usuário envia e recebe pelo menu E-mail com um endereço no domínio da imobiliária."
        }
        icon={<Inbox className="size-5" />}
        right={
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                cfg.mailboxEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-soft text-subtle",
              )}
            >
              {cfg.mailboxEnabled ? "Ativo" : "Desativado"}
            </span>
            <Switch checked={cfg.mailboxEnabled} disabled={toggling} onChange={toggle} />
          </div>
        }
      >
        <p className="text-xs leading-relaxed text-subtle">
          Desativado, o menu E-mail some do CRM e os e-mails que chegarem ao webhook não são guardados. Os avisos de
          novos leads e a Negociação continuam funcionando.
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">O que é necessário</p>
          <Button variant="outline" size="sm" loading={checking} onClick={runCheck} disabled={!cfg.hasKey}>
            <RefreshCw className="size-4" />
            Verificar no Resend
          </Button>
        </div>

        <ul className="mt-2 divide-y divide-hairline">
          <Step state={cfg.hasKey ? "ok" : "todo"} title="Chave do Resend salva">
            Na seção acima.
          </Step>
          <Step state={domain ? "ok" : "todo"} title="Remetente num domínio próprio">
            {domain ? `Domínio das caixas: ${domain}` : "Informe o e-mail do remetente acima."}
          </Step>

          {check && !check.fullAccess && (
            <Step state="fail" title="Chave com acesso total">
              {check.error}
            </Step>
          )}
          {check?.fullAccess && (
            <>
              <Step state="ok" title="Chave com acesso total" />
              {!d ? (
                <Step state="fail" title="Domínio cadastrado no Resend">
                  {check.domainName
                    ? `O domínio ${check.domainName} não está na conta do Resend desta chave.`
                    : "Informe o e-mail do remetente."}
                </Step>
              ) : (
                <>
                  <Step state={d.status === "verified" ? "ok" : "fail"} title="Domínio verificado no Resend">
                    Situação: {d.status}
                    {d.records.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {d.records.map((r, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                r.status === "verified" ? "bg-emerald-500" : "bg-amber-500",
                              )}
                            />
                            <span className="font-medium text-ink">{RECORD_LABEL[r.record] ?? r.record}</span>
                            <span className="font-mono">
                              {r.type} {r.name}
                            </span>
                            <span>· {r.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Step>
                  <Step state={d.sending === "enabled" ? "ok" : "fail"} title="Envio ligado no domínio" />
                  <Step state={d.receiving === "enabled" ? "ok" : "fail"} title="Recebimento ligado no domínio">
                    {d.receiving !== "enabled" &&
                      "Em resend.com › Domains › seu domínio, ative o recebimento e crie o registro MX que ele indicar."}
                  </Step>
                  <Step state={tracking ? "warn" : "ok"} title="Rastreamento de cliques e aberturas desligado">
                    {tracking
                      ? `Ligado (${[d.openTracking && "aberturas", d.clickTracking && "cliques"].filter(Boolean).join(" e ")}). Isso troca os links e aumenta a chance de cair no spam: desligue em resend.com › Domains › Configuration.`
                      : "Bom para não cair no spam."}
                  </Step>
                  <Step state={check.readReceived ? "ok" : "fail"} title="Leitura de e-mails recebidos">
                    {!check.readReceived && "O Resend recusou a leitura dos e-mails recebidos com esta chave."}
                  </Step>
                </>
              )}
            </>
          )}
          {!check && cfg.hasKey && (
            <Step state="todo" title="Chave, domínio, recebimento e rastreamento">
              Clique em Verificar no Resend.
            </Step>
          )}

          <Step state={cfg.webhookSecret ? "ok" : "todo"} title="Webhook de e-mails recebidos">
            Em resend.com › Webhooks, crie um webhook com o evento <code className="font-mono">email.received</code>{" "}
            para o endereço abaixo e cole o “Signing secret”.
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-soft px-3 py-2 font-mono text-[11px] text-ink">
                {cfg.inboundUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copiar endereço"
                onClick={() => navigator.clipboard.writeText(cfg.inboundUrl).then(() => toast.success("Copiado."))}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={cfg.webhookSecret}
                onChange={(e) => set("webhookSecret", e.target.value)}
                placeholder="whsec_…"
                className="h-9 font-mono text-xs"
                autoComplete="off"
              />
              <Button variant="outline" size="sm" loading={saving} onClick={save}>
                Salvar
              </Button>
            </div>
          </Step>
          <Step state={cfg.usersWithMailbox > 0 ? "ok" : "todo"} title="Endereço de cada usuário">
            {cfg.usersWithMailbox > 0
              ? `${cfg.usersWithMailbox} ${cfg.usersWithMailbox === 1 ? "usuário tem" : "usuários têm"} endereço. `
              : "Nenhum usuário com endereço ainda. "}
            {cfg.mailboxEnabled ? (
              <Link href="/admin/equipe" className="font-medium text-ink underline underline-offset-2">
                Definir em Equipe &amp; acessos
              </Link>
            ) : (
              "O campo aparece em Equipe & acessos depois de ativar."
            )}
          </Step>
          <Step state={cfg.lastReceivedAt ? "ok" : "todo"} title="Primeiro e-mail recebido">
            {cfg.lastReceivedAt
              ? `Último recebido em ${formatDateTime(cfg.lastReceivedAt)}.`
              : "Depois de ativar, mande um e-mail de teste para o endereço de um usuário."}
          </Step>
        </ul>
      </Section>
    </div>
  );
}
