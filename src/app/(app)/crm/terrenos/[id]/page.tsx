import { PropertyDetail } from "@/components/crm/property-detail";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terreno" };

export default async function TerrenoCrmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PropertyDetail id={id} section="terrenos" />;
}
