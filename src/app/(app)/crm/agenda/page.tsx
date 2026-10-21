import { AgendaClient } from "@/components/crm/agenda-client";
import { listAgendaEvents, listContacts, listProperties, listVisits } from "@/lib/queries";
import { getReminderSettings } from "@/lib/features";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; visita?: string; nova?: string }>;
}) {
  const { tipo, visita, nova } = await searchParams;
  const [visits, contacts, properties, events, reminders] = await Promise.all([
    listVisits(),
    listContacts(),
    listProperties(),
    listAgendaEvents(),
    getReminderSettings(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Agendamento
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Agenda
          </h1>
        </div>
        <p className="text-xs text-subtle">
          Sincronizada com Google Calendar
          {reminders.enabled &&
            ` · lembrete por WhatsApp ${reminders.hoursBefore === 24 ? "1 dia" : reminders.hoursBefore === 48 ? "2 dias" : `${reminders.hoursBefore} h`} antes`}
        </p>
      </div>
      <AgendaClient
        initialVisits={visits}
        initialEvents={events}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        properties={properties
          .filter((p) => ["disponivel", "reservado"].includes(p.status))
          .map((p) => ({ id: p.id, code: p.code, title: p.title, type: p.type }))}
        initialTab={tipo === "imoveis" || tipo === "terrenos" || tipo === "rurais" || tipo === "eventos" ? tipo : "todas"}
        openVisitId={visita}
        openNew={!!nova}
      />
    </div>
  );
}
