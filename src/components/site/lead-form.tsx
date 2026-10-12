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

/** Objetivo do contato na página de um imóvel */
const GOALS = [
  "Receber mais informações",
  "Agendar uma visita",
  "Simular financiamento",
  "Fazer uma proposta",
  "Propor permuta",
];

/** Faixas de orçamento ("mín-máx" em reais; vazio = sem limite) */
const BUDGETS: { group: string; options: [string, string][] }[] = [
  {
    group: "Compra",
    options: [
      ["0-300000", "Até R$ 300 mil"],
      ["300000-500000", "R$ 300 a 500 mil"],
      ["500000-1000000", "R$ 500 mil a 1 milhão"],
      ["1000000-2000000", "R$ 1 a 2 milhões"],
      ["2000000-5000000", "R$ 2 a 5 milhões"],
      ["5000000-", "Acima de R$ 5 milhões"],
    ],
  },
  {
    group: "Aluguel (por mês)",
    options: [
      ["0-2000", "Aluguel até R$ 2 mil"],
      ["2000-5000", "Aluguel de R$ 2 a 5 mil"],
      ["5000-", "Aluguel acima de R$ 5 mil"],
    ],
  },
];

/**
 * Formulário de contato do site: o lead entra direto no CRM.
 * Com `property`, o contato fica vinculado ao imóvel (e abre negociação).
 */
export function LeadForm({
  property,
  origin = "site",
}: {
  property?: { id: string; code: string; title: string };
  origin?: "site" | "qr";
} = {}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    interest: "",
    region: "",
    budget: "",
    goal: GOALS[0],
    message: "",
    website: "",
  });
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
        body: JSON.stringify({ ...form, propertyId: property?.id, origin }),
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
        <p className="text-balance font-display text-xl font-semibold tracking-tight sm:text-2xl">Recebemos seu contato!</p>
        <p className="max-w-sm text-sm text-subtle">
          Em breve um consultor fala com você pelo WhatsApp{" "}
          {form.phone && `(${form.phone})`}
          {property ? ` sobre ${property.code}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Nome">
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="name"
          placeholder="Digite seu nome"
          required
        />
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
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
          placeholder="Digite seu melhor e-mail"
        />
      </Field>
      {property && (
        <Field label="Gostaria de">
          <Select value={form.goal} onChange={(e) => set("goal", e.target.value)}>
            {GOALS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
      )}
      {!property && (
        <Field label="Tenho interesse em">
          <Select value={form.interest} onChange={(e) => set("interest", e.target.value)}>
            {INTERESTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
      )}
      {!property && (
        <>
          <Field label="Região de interesse">
            <Input
              value={form.region}
              onChange={(e) => set("region", e.target.value)}
              placeholder="Bairro, cidade ou região"
              maxLength={200}
            />
          </Field>
          <Field label="Orçamento">
            <Select value={form.budget} onChange={(e) => set("budget", e.target.value)}>
              <option value="">Ainda não sei</option>
              {BUDGETS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </>
      )}
      <Field label="Mensagem (opcional)" className="sm:col-span-2">
        <Textarea
          rows={4}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder={
            property
              ? "Ex.: quero agendar uma visita, saber sobre financiamento, aceita permuta?"
              : "Quartos, prazo, forma de pagamento… conte o que procura."
          }
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
