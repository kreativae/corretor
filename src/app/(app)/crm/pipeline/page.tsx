import { Kanban } from "@/components/crm/kanban";
import { getFeatures } from "@/lib/features";
import { listContacts, listDeals, listProperties } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; negocio?: string }>;
}) {
  const { tipo, negocio } = await searchParams;
  const [deals, contacts, properties, features] = await Promise.all([
    listDeals(),
    listContacts(),
    listProperties(),
    getFeatures(),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            CRM de vendas
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Pipeline
          </h1>
        </div>
        <p className="text-xs text-subtle">
          Arraste os cartões entre os estágios — tudo fica registrado na linha
          do tempo.
        </p>
      </div>
      <Kanban
        initialDeals={deals}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        properties={properties
          .filter((p) => ["disponivel", "reservado"].includes(p.status))
          .map((p) => ({ id: p.id, code: p.code, title: p.title, price: p.price, type: p.type }))}
        showClosedLink={features.closedDeals}
        initialTab={negocio ? "todos" : tipo === "rurais" || tipo === "todos" ? tipo : "imoveis"}
        focusDealId={negocio}
      />
    </div>
  );
}
