import { PropertyForm } from "@/components/crm/property-form";
import { getCustomFeatures } from "@/lib/features";
import { listResponsibles } from "@/lib/responsible";
import { getPropertyById, listPartners } from "@/lib/queries";
import { crmPropertyPath, isRuralType } from "@/lib/rural";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar imóvel" };

export default async function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getPropertyById(id);
  if (!property) notFound();
  const [partners, customFeatures, team] = await Promise.all([
    listPartners(),
    getCustomFeatures(),
    listResponsibles(),
  ]);
  if (isRuralType(property.type)) redirect(crmPropertyPath(property, "/editar"));
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm initial={property} partners={partners} customFeatures={customFeatures} team={team} />
    </div>
  );
}
