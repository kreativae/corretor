import { AgendaClient } from "@/components/crm/agenda-client";
import { listContacts, listProperties, listVisits } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; visita?: string }>;
}) {
  const { tipo, visita } = await searchParams;
  const [visits, contacts, properties] = await Promise.all([
    listVisits(),
    listContacts(),
    listProperties(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Agendamento
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Agenda de visitas
          </h1>
        </div>
        <p className="text-xs text-subtle">
          Sincronizada com Google Calendar · lembretes automáticos via WhatsApp
        </p>
      </div>
      <AgendaClient
        initialVisits={visits}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        properties={properties
          .filter((p) => ["disponivel", "reservado"].includes(p.status))
          .map((p) => ({ id: p.id, code: p.code, title: p.title, type: p.type }))}
        initialTab={tipo === "imoveis" || tipo === "rurais" ? tipo : "todas"}
        openVisitId={visita}
      />
    </div>
  );
}
