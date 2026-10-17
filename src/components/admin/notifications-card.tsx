"use client";

import { Button, Field, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BellRing, Check, ChevronDown, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type EmailCfg = {
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  hasKey: boolean;
  webhookSecret: string;
  inboundUrl?: string;
};

/** Avisos de novos leads: liga/desliga, conta do Resend, destinatários e e-mail de teste. */
export function NotificationsCard({
  initialEmails,
  initialEnabled,
  fallbackEmail,
  configured: initialConfigured,
}: {
  initialEmails: string;
  initialEnabled: boolean;
  fallbackEmail: string;
  configured: boolean;
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [configured, setConfigured] = useState(initialConfigured);
  const [cfg, setCfg] = useState<EmailCfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  // Recolhido (sanfona); abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const recipients = (emails.trim() || fallbackEmail)
    .split(/[,;\s]+/)
    .filter(Boolean);

  // Conta do Resend: carrega ao abrir (a chave vem mascarada)
  useEffect(() => {
    if (!open || cfg) return;
    fetch("/api/email-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => undefined);
  }, [open, cfg]);

  const setField = <K extends keyof EmailCfg>(k: K, v: EmailCfg[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function saveNotify(next: { leadEmails: string; enabled: boolean }) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "notifications", value: next }),
    });
    if (!res.ok) throw new Error();
  }

  async function toggle(v: boolean) {
    setEnabled(v);
    setToggling(true);
    try {
      await saveNotify({ leadEmails: emails, enabled: v });
      toast.success(v ? "Avisos de novos leads ativados." : "Avisos de novos leads desativados.");
    } catch {
      setEnabled(!v);
      toast.error("Não foi possível salvar.");
    } finally {
      setToggling(false);
    }
  }

  async function save(silent = false) {
    setSaving(true);
    try {
      await saveNotify({ leadEmails: emails, enabled });
      if (cfg) {
        const res = await fetch("/api/email-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setCfg({ ...d, inboundUrl: cfg.inboundUrl });
        setConfigured(d.hasKey);
      }
      if (!silent) toast.success("Avisos salvos.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      if (!(await save(true))) return;
      const res = await fetch("/api/notify/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(`E-mail de teste enviado para ${data.to.join(", ")}.`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha no envio.");
    } finally {
      setTesting(false);
    }
  }

  const status = !enabled
    ? { label: "Desativado", cls: "bg-soft text-subtle" }
    : configured
      ? { label: "Ativo", cls: "bg-emerald-500/10 text-emerald-600" }
      : { label: "Falta a chave do Resend", cls: "bg-amber-500/10 text-amber-600" };

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <div className="flex flex-wrap items-center gap-3 p-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
            <BellRing className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-semibold tracking-tight">Avisos de novos leads</span>
            <span className={cn("mt-1 block max-w-xl text-xs text-subtle", !open && "truncate")}>
              {open
                ? "E-mail a cada contato pelo formulário do site, visita agendada no site ou lead recebido pelo webhook."
                : !enabled
                  ? "Avisos desligados — clique para configurar"
                  : recipients.length
                    ? `Enviando para ${recipients.join(", ")} — clique para editar`
                    : "Nenhum destinatário — clique para configurar"}
            </span>
          </span>
        </button>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", status.cls)}>{status.label}</span>
        <Switch checked={enabled} disabled={toggling} onChange={toggle} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Recolher" : "Abrir"}
          className="rounded-full p-2 text-subtle transition-colors hover:bg-soft hover:text-ink"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
        </button>
      </div>

      <div
        className={cn("grid transition-[grid-template-rows] duration-500 ease-expo", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="space-y-6 border-t border-hairline p-6">
            {/* Conta do Resend */}
            <div className="space-y-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">Conta do Resend</p>
              {!cfg ? (
                <div className="flex justify-center py-4 text-subtle">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : (
                <>
                  <Field
                    label="API Key"
                    hint="Em resend.com › API Keys (permissão “Sending access”). Para remover, digite um hífen (-) e salve."
                  >
                    <Input
                      value={cfg.resendApiKey}
                      onChange={(e) => setField("resendApiKey", e.target.value)}
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
                        onChange={(e) => setField("fromEmail", e.target.value)}
                        placeholder="avisos@suaimobiliaria.com.br"
                      />
                    </Field>
                    <Field label="Nome do remetente" hint="Vazio = nome da imobiliária.">
                      <Input value={cfg.fromName} onChange={(e) => setField("fromName", e.target.value)} placeholder="Carlos Amâncio Imóveis" />
                    </Field>
                  </div>
                  <p className="rounded-xl bg-soft px-3 py-2.5 text-xs text-subtle">
                    A mesma conta envia os e-mails da Negociação (fichas para o cliente). Desligar os avisos não afeta esses envios.
                  </p>
                  <div className="space-y-3 border-t border-hairline pt-4">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">
                      Caixa de e-mail dos usuários
                    </p>
                    <p className="text-xs leading-relaxed text-subtle">
                      Cada usuário com endereço definido em Equipe &amp; acessos envia e recebe pelo menu E-mail, no
                      domínio do remetente acima. Para receber: aponte o MX do domínio para o Resend e crie em
                      resend.com › Webhooks um webhook com o evento <code className="font-mono">email.received</code>{" "}
                      para o endereço abaixo.
                    </p>
                    {cfg.inboundUrl && (
                      <code className="block break-all rounded-xl bg-soft px-3 py-2.5 font-mono text-xs">
                        {cfg.inboundUrl}
                      </code>
                    )}
                    <Field
                      label="Segredo do webhook"
                      hint="Signing secret do webhook no Resend (whsec_…). Para remover, digite um hífen (-) e salve."
                    >
                      <Input
                        value={cfg.webhookSecret}
                        onChange={(e) => setField("webhookSecret", e.target.value)}
                        placeholder="whsec_…"
                        className="font-mono text-xs"
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                </>
              )}
            </div>

            {/* Destinatários */}
            <div className="space-y-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">Quem recebe os avisos</p>
              <Field
                label="Enviar para"
                hint={`Um ou mais e-mails, separados por vírgula${fallbackEmail ? ` · vazio = ${fallbackEmail}` : ""}`}
              >
                <Input
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="voce@imobiliaria.com.br, corretor@imobiliaria.com.br"
                />
              </Field>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" loading={testing} onClick={test} disabled={saving}>
                <Send className="size-4" />
                Enviar teste
              </Button>
              <Button variant="accent" loading={saving} onClick={() => save()} disabled={testing}>
                <Check className="size-4" />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
