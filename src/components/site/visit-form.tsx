"use client";

import { Button, Field, Input, Select } from "@/components/ui";
import { CalendarCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export function VisitForm({
  propertyId,
  propertyCode,
}: {
  propertyId: string;
  propertyCode: string;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", date: "", time: "10:00" });

  const today = new Date().toISOString().split("T")[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.date) {
      toast.error("Preencha nome, telefone e data.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          name: form.name,
          phone: form.phone,
          date: form.date,
          time: form.time,
          source: "site",
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      toast.success("Visita agendada — confirmamos em instantes.");
    } catch {
      toast.error("Não foi possível agendar. Tente pelo WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-hairline bg-card p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <CalendarCheck className="size-6" />
        </span>
        <p className="mt-4 font-display text-xl font-semibold tracking-tight">
          Visita reservada
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-subtle">
          {form.name.split(" ")[0]}, reservamos {propertyCode} para{" "}
          <span className="font-medium text-ink">
            {new Date(form.date + "T12:00").toLocaleDateString("pt-BR")} às {form.time}
          </span>
          . Um corretor confirma pelo seu WhatsApp em até 30 min.
        </p>
        <Button variant="outline" size="sm" className="mt-6" onClick={() => setDone(false)}>
          Agendar outro horário
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-hairline bg-card p-6 md:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Como podemos te chamar?"
            autoComplete="name"
          />
        </Field>
        <Field label="WhatsApp" className="sm:col-span-2">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(11) 98765-4321"
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>
        <Field label="Data">
          <Input
            type="date"
            min={today}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Horário">
          <Select
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          >
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={loading}
        className="mt-6 w-full"
      >
        Reservar visita
      </Button>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-subtle">
        Sem compromisso. Seus dados ficam apenas com a {`equipe`} e nunca são
        compartilhados.
      </p>
    </form>
  );
}
