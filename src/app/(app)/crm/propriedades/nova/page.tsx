import { PropertyForm } from "@/components/crm/property-form";
import { listPartners } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nova propriedade rural" };

export default async function NovaPropriedadePage() {
  const partners = await listPartners();
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm kind="rural" partners={partners} />
    </div>
  );
}
