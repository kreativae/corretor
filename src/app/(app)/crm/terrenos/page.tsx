import { PropertiesTable } from "@/components/crm/properties-table";
import { isLandType } from "@/lib/land";
import { listProperties, listPropertyViewTotals } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terrenos" };

export default async function TerrenosPage() {
  const [all, viewCounts] = await Promise.all([listProperties(), listPropertyViewTotals()]);
  const properties = all.filter((p) => isLandType(p.type));
  const totalM2 = properties.reduce((s, p) => s + (p.area || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Lotes, lotes em condomínio, comerciais e áreas
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Terrenos</h1>
        </div>
        <p className="text-xs text-subtle">
          {properties.length} registros · {totalM2.toLocaleString("pt-BR")} m² em carteira ·{" "}
          {properties.filter((p) => p.published).length} publicados no site
        </p>
      </div>
      <PropertiesTable initial={properties} viewCounts={viewCounts} kind="terreno" />
    </div>
  );
}
