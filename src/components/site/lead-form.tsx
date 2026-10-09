"use client";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INTERESTS: [string, string][] = [
  ["", "Ainda não sei"],
  ["apartamento", "Apartamento"],
  ["casa", "Casa"],
  ["cobertura", "Cobertura"],
  ["terreno", "Terreno"],
  ["fazenda", "Fazenda"],
  ["sitio", "Sítio"],
  ["chacara", "Chácara"],
];

/** Formulário de contato do site: o lead entra direto no CRM. */
export function LeadForm() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", interest: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe seu nome e um WhatsApp com DDD.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-accent" />
        <p className="font-display text-2xl font-semibold tracking-tight">Recebemos seu contato!</p>
        <p className="max-w-sm text-sm text-subtle">
          Em breve um corretor fala com você pelo WhatsApp {form.phone && `(${form.phone})`}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Nome">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
      </Field>
      <Field label="WhatsApp">
        <Input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(43) 99999-9999"
          required
        />
      </Field>
      <Field label="E-mail (opcional)">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
      </Field>
      <Field label="Tenho interesse em">
        <Select value={form.interest} onChange={(e) => set("interest", e.target.value)}>
          {INTERESTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <Field label="Mensagem (opcional)" className="sm:col-span-2">
        <Textarea
          rows={4}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Região, faixa de valor, prazo… conte o que procura."
          maxLength={1000}
        />
      </Field>
      {/* Campo isca: invisível para pessoas, preenchido por robôs */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-relaxed text-subtle">
          Usamos seus dados só para responder ao seu contato.
        </p>
        <Button type="submit" variant="accent" loading={sending} className="h-12 px-7">
          <Send className="size-4" />
          Enviar
        </Button>
      </div>
    </form>
  );
}
