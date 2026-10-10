"use client";

import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BellRing, Check, ChevronDown, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Destinatários dos avisos de novos leads + e-mail de teste. */
export function NotificationsCard({
  initialEmails,
  fallbackEmail,
  configured,
}: {
  initialEmails: string;
  fallbackEmail: string;
  configured: boolean;
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // Recolhido (sanfona); abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const recipients = (emails.trim() || fallbackEmail)
    .split(/[,;\s]+/)
    .filter(Boolean);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "notifications", value: { leadEmails: emails } }),
      });
      if (!res.ok) throw new Error();
      toast.success("Destinatários salvos.");
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
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
            <span className="block font-display text-base font-semibold tracking-tight">
              Avisos de novos leads
            </span>
            <span className={cn("mt-1 block max-w-xl text-xs text-subtle", !open && "truncate")}>
              {open
                ? "E-mail a cada contato pelo formulário do site, visita agendada no site ou lead recebido pelo webhook."
                : recipients.length
                  ? `Enviando para ${recipients.join(", ")} — clique para editar`
                  : "Nenhum destinatário — clique para configurar"}
            </span>
          </span>
        </button>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            configured ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
          )}
        >
          {configured ? "Envio configurado" : "Falta RESEND_API_KEY na Vercel"}
        </span>
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
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
      <div className="min-h-0 overflow-hidden" inert={!open}>
      <div className="border-t border-hairline p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="Enviar para"
          hint={`Um ou mais e-mails, separados por vírgula${fallbackEmail ? ` · vazio = ${fallbackEmail}` : ""}`}
          className="flex-1"
        >
          <Input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="voce@imobiliaria.com.br, corretor@imobiliaria.com.br"
          />
        </Field>
        <div className="flex gap-2 sm:pb-[22px]">
          <Button variant="outline" loading={saving} onClick={save}>
            <Check className="size-4" />
            Salvar
          </Button>
          <Button variant="accent" loading={testing} onClick={test} disabled={!configured}>
            <Send className="size-4" />
            Enviar teste
          </Button>
        </div>
      </div>
      </div>
      </div>
      </div>
    </section>
  );
}
