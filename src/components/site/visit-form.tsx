"use client";

import { Button, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CalendarCheck } from "lucide-react";
import type { SiteContent } from "@/lib/site-content";
import { visitDates, visitTimesFor } from "@/lib/visit-slots";
import { useHydrated } from "@/lib/use-hydrated";
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
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", date: "", time: "" });

  // Datas e horários dependem de "agora": calculados só no navegador (evita divergir do servidor)
  const hydrated = useHydrated();
  const dates = hydrated ? visitDates(t) : [];
  const date = dates.some((d) => d.value === form.date) ? form.date : (dates[0]?.value ?? "");
  const times = date ? visitTimesFor(date, t) : [];
  const time = times.includes(form.time) ? form.time : times.includes("10:00") ? "10:00" : (times[0] ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !date || !time) {
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
          date,
          time,
          source: "site",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error);
      }
      setForm((f) => ({ ...f, date, time }));
      setDone(true);
      toast.success("Visita agendada — confirmamos em instantes.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível agendar. Tente pelo WhatsApp.");
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
          <Select value={date} onChange={(e) => setForm({ ...form, date: e.target.value })}>
            {dates.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.timeLabel}>
          <Select value={time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
            {times.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </Select>
        </Field>
      </div>
      {hydrated && !dates.length && (
        <p className="mt-3 text-xs text-subtle">Sem datas abertas para visita no momento. Fale com a gente pelo WhatsApp.</p>
      )}
      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={loading}
        disabled={!date || !time}
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
