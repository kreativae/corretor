import { PropertyForm } from "@/components/crm/property-form";
import { getKmzPassword } from "@/lib/kmz-lock";
import { getCustomFeatures } from "@/lib/features";
import { listResponsibles } from "@/lib/responsible";
import { getPropertyById, listPartners } from "@/lib/queries";
import { crmPropertyPath } from "@/lib/rural";
import { isLandType } from "@/lib/land";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar terreno" };

export default async function EditarTerrenoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getPropertyById(id);
  if (!property) notFound();
  const [partners, customFeatures, team, kmzPassword] = await Promise.all([
    listPartners(),
    getCustomFeatures(),
    listResponsibles(),
    getKmzPassword(property.id),
  ]);
  if (!isLandType(property.type)) redirect(crmPropertyPath(property, "/editar"));
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm initial={property} partners={partners} customFeatures={customFeatures} team={team} kmzPassword={kmzPassword ?? ""} />
    </div>
  );
}
