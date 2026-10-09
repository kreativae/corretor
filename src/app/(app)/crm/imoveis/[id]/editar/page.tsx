import { PropertyForm } from "@/components/crm/property-form";
import { getPropertyById } from "@/lib/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm initial={property} />
    </div>
  );
}
