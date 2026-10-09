import { PropertyForm } from "@/components/crm/property-form";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nova propriedade rural" };

export default function NovaPropriedadePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm kind="rural" />
    </div>
  );
}
