import { PropertyForm } from "@/components/crm/property-form";
import { getCustomFeatures } from "@/lib/features";
import { listPartners } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nova propriedade rural" };

export default async function NovaPropriedadePage() {
  const [partners, customFeatures] = await Promise.all([listPartners(), getCustomFeatures()]);
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm kind="rural" partners={partners} customFeatures={customFeatures} />
    </div>
  );
}
