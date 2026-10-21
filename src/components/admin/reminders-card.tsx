"use client";

import { Select, Switch } from "@/components/ui";
import { REMINDER_HOURS, type ReminderSettings } from "@/lib/reminder-settings";
import { cn } from "@/lib/utils";
import { BellRing, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const hoursLabel = (h: number) => (h === 24 ? "1 dia antes" : h === 48 ? "2 dias antes" : `${h} ${h === 1 ? "hora" : "horas"} antes`);

/** Configurações › Lembretes da agenda: WhatsApp ao cliente antes da visita, reunião ou evento */
export function RemindersCard({ initial, waReady }: { initial: ReminderSettings; waReady: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [open, setOpen] = useState(false);

  async function save(next: ReminderSettings) {
    const prev = s;
    setS(next);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "reminders", value: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next.enabled ? `Lembretes ${hoursLabel(next.hoursBefore)}.` : "Lembretes desligados.");
      router.refresh();
    } catch {
      setS(prev);
      toast.error("Não foi possível salvar.");
    }
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-6 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <BellRing className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold tracking-tight">Lembretes da agenda</span>
          <span className="mt-1 block text-xs text-subtle">
            {s.enabled ? `WhatsApp ao cliente ${hoursLabel(s.hoursBefore)} da visita, reunião ou evento` : "Desligados"} — clique para
            ajustar
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-hairline p-6">
          {!waReady && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              O WhatsApp ainda não está conectado: os lembretes começam a sair quando estiver.
            </p>
          )}
          <label className="flex items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Enviar lembretes</span>
              <span className="block text-[11px] text-subtle">
                Para o cliente da visita (agendada ou confirmada) e da reunião ou evento com cliente vinculado. Um por horário;
                reagendar envia outro.
              </span>
            </span>
            <Switch checked={s.enabled} onChange={(v) => save({ ...s, enabled: v })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-subtle">Quando enviar</span>
            <Select value={String(s.hoursBefore)} onChange={(e) => save({ ...s, hoursBefore: Number(e.target.value) })} disabled={!s.enabled}>
              {REMINDER_HOURS.map((h) => (
                <option key={h} value={h}>
                  {hoursLabel(h)}
                </option>
              ))}
            </Select>
          </label>
          <p className="text-[11px] text-subtle">
            Sai pelo número principal do WhatsApp. O texto fica em Mensagens › Lembretes da agenda. Agendou com menos antecedência
            que isso? O lembrete sai em até 10 minutos.
          </p>
        </div>
      )}
    </section>
  );
}
