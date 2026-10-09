"use client";

import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BellRing, Check, Send } from "lucide-react";
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
    <section className="card-elev rounded-2xl border border-hairline bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
            <BellRing className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Avisos de novos leads
            </h2>
            <p className="mt-1 max-w-xl text-xs text-subtle">
              E-mail a cada contato pelo formulário do site, visita agendada no site ou lead
              recebido pelo webhook.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            configured ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
          )}
        >
          {configured ? "Envio configurado" : "Falta RESEND_API_KEY na Vercel"}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
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
    </section>
  );
}
