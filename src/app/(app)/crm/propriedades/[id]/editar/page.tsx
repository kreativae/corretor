import { PropertyForm } from "@/components/crm/property-form";
import { getCustomFeatures } from "@/lib/features";
import { getPropertyById, listPartners } from "@/lib/queries";
import { crmPropertyPath, isRuralType } from "@/lib/rural";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar propriedade rural" };

export default async function EditarPropriedadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getPropertyById(id);
  if (!property) notFound();
  const [partners, customFeatures] = await Promise.all([listPartners(), getCustomFeatures()]);
  if (!isRuralType(property.type)) redirect(crmPropertyPath(property, "/editar"));
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm initial={property} partners={partners} customFeatures={customFeatures} />
    </div>
  );
}
