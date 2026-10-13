import { PropertyForm } from "@/components/crm/property-form";
import { getCustomFeatures } from "@/lib/features";
import { listPartners } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo imóvel" };

export default async function NovoImovelPage() {
  const [partners, customFeatures] = await Promise.all([listPartners(), getCustomFeatures()]);
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm partners={partners} customFeatures={customFeatures} />
    </div>
  );
}
