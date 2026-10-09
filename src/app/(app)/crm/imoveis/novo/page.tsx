import { PropertyForm } from "@/components/crm/property-form";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo imóvel" };

export default function NovoImovelPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm />
    </div>
  );
}
