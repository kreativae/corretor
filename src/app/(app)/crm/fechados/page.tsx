import { ClosedDealsClient } from "@/components/crm/closed-deals-client";
import { getFeatures } from "@/lib/features";
import { listDealClosedDates, listDeals } from "@/lib/queries";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Negócios fechados" };

export default async function FechadosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  // Página opcional — ativada em Configurações › Módulos do CRM
  if (!(await getFeatures()).closedDeals) redirect("/crm/pipeline");
  const { tipo } = await searchParams;
  const [deals, closedDates] = await Promise.all([listDeals(), listDealClosedDates()]);
  const closed = deals.filter((d) => d.deal.stage === "fechado");

  // Sem registro na linha do tempo, usa a última atualização do negócio
  const closedAt: Record<string, string> = {};
  for (const d of closed)
    closedAt[d.deal.id] = closedDates[d.deal.id] ?? new Date(d.deal.updatedAt).toISOString();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
          CRM de vendas
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Negócios fechados
        </h1>
      </div>
      <ClosedDealsClient
        deals={closed}
        closedAt={closedAt}
        initialTab={tipo === "imoveis" || tipo === "rurais" ? tipo : "todos"}
      />
    </div>
  );
}
