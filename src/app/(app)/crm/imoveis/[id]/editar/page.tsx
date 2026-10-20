import { PropertyForm } from "@/components/crm/property-form";
import { getKmzPassword } from "@/lib/kmz-lock";
import { getBadgeSettings, getCustomFeatures } from "@/lib/features";
import { listResponsibles } from "@/lib/responsible";
import { getPropertyById, listPartners } from "@/lib/queries";
import { crmPropertyPath, kindOf } from "@/lib/rural";
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
  const [partners, customFeatures, team, kmzPassword] = await Promise.all([
    listPartners(),
    getCustomFeatures(),
    listResponsibles(),
    getKmzPassword(property.id),
  ]);
  if (kindOf(property.type) !== "urbano") redirect(crmPropertyPath(property, "/editar"));
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm badges={(await getBadgeSettings()).items} initial={property} partners={partners} customFeatures={customFeatures} team={team} kmzPassword={kmzPassword ?? ""} />
    </div>
  );
}
