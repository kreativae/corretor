import { PropertiesTable } from "@/components/crm/properties-table";
import { listProperties, listPropertyViewTotals } from "@/lib/queries";
import { isRuralType } from "@/lib/rural";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Imóveis" };

export default async function ImoveisCrmPage() {
  const [all, viewCounts] = await Promise.all([
    listProperties(),
    listPropertyViewTotals(),
  ]);
  // Rurais ficam em /crm/propriedades
  const properties = all.filter((p) => !isRuralType(p.type));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Gestão de portfólio
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Imóveis
          </h1>
        </div>
        <p className="text-xs text-subtle">
          {properties.length} registros ·{" "}
          {properties.filter((p) => p.published).length} publicados no site
        </p>
      </div>
      <PropertiesTable initial={properties} viewCounts={viewCounts} />
    </div>
  );
}
