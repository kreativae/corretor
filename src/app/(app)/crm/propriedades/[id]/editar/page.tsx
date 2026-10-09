import { PropertyForm } from "@/components/crm/property-form";
import { getPropertyById } from "@/lib/queries";
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
  if (!isRuralType(property.type)) redirect(crmPropertyPath(property, "/editar"));
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm initial={property} />
    </div>
  );
}
