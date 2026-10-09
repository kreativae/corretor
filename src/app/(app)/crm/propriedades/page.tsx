import { PropertiesTable } from "@/components/crm/properties-table";
import { listProperties, listPropertyViewTotals } from "@/lib/queries";
import { isRuralType, normalizeRural, ruralAreas, formatAlq } from "@/lib/rural";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Propriedades rurais" };

export default async function PropriedadesPage() {
  const [all, viewCounts] = await Promise.all([listProperties(), listPropertyViewTotals()]);
  const properties = all.filter((p) => isRuralType(p.type));
  const totalAlq = properties.reduce((s, p) => s + ruralAreas(normalizeRural(p.rural)).total, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Fazendas, sítios e chácaras
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Propriedades rurais
          </h1>
        </div>
        <p className="text-xs text-subtle">
          {properties.length} registros · {formatAlq(totalAlq)} alqueires em carteira ·{" "}
          {properties.filter((p) => p.published).length} publicadas no site
        </p>
      </div>
      <PropertiesTable initial={properties} viewCounts={viewCounts} kind="rural" />
    </div>
  );
}
