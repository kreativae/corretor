"use client";

import { Button, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CalendarCheck } from "lucide-react";
import type { SiteContent } from "@/lib/site-content";
import { useState } from "react";
import { toast } from "sonner";

export function VisitForm({
  propertyId,
  propertyCode,
  texts: t,
  className,
}: {
  propertyId: string;
  propertyCode: string;
  /** Textos editáveis em Conteúdo do site › Visita guiada */
  texts: SiteContent["visit"];
  className?: string;
}) {
  const times = t.times.filter(Boolean);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", date: "", time: t.times.includes("10:00") ? "10:00" : (t.times[0] ?? "") });

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
      <div className={cn("flex flex-col items-center rounded-2xl border border-hairline bg-card p-10 text-center", className)}>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <CalendarCheck className="size-6" />
        </span>
        <p className="mt-4 font-display text-xl font-semibold tracking-tight">
          {t.successTitle}
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-subtle">
          {t.successText
            .replaceAll("{nome}", form.name.trim().split(" ")[0])
            .replaceAll("{codigo}", propertyCode)
            .replaceAll("{data}", new Date(form.date + "T12:00").toLocaleDateString("pt-BR"))
            .replaceAll("{hora}", form.time)}
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
      className={cn("rounded-2xl border border-hairline bg-card p-6 md:p-8", className)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.nameLabel} className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.namePlaceholder}
            autoComplete="name"
          />
        </Field>
        <Field label={t.phoneLabel} className="sm:col-span-2">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder={t.phonePlaceholder}
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>
        <Field label={t.dateLabel}>
          <Input
            type="date"
            min={today}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label={t.timeLabel}>
          <Select
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          >
            {times.map((h) => (
              <option key={h}>{h}</option>
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
        {t.button}
      </Button>
      {t.note && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-subtle">{t.note}</p>
      )}
    </form>
  );
}
