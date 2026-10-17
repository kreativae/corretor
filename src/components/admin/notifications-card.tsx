"use client";

import { Button, Field, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BellRing, Check, ChevronDown, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

/** Avisos de novos leads: liga/desliga, destinatários e e-mail de teste (a conta do Resend fica em Administração › E-mail). */
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
  const configured = initialConfigured;
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  // Recolhido (sanfona); abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const recipients = (emails.trim() || fallbackEmail)
    .split(/[,;\s]+/)
    .filter(Boolean);

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
            <p className="rounded-xl bg-soft px-3 py-2.5 text-xs text-subtle">
              {configured ? "Enviados pela conta do Resend configurada em " : "Configure primeiro a conta do Resend em "}
              <Link href="/admin/email" className="font-medium text-ink underline underline-offset-2">
                Administração › E-mail
              </Link>
              .
            </p>

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
