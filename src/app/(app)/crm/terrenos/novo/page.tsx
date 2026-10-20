import { PropertyForm } from "@/components/crm/property-form";
import { getBadgeSettings, getCustomFeatures } from "@/lib/features";
import { getCurrentUser } from "@/lib/auth";
import { listResponsibles } from "@/lib/responsible";
import { listPartners } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo terreno" };

export default async function NovoTerrenoPage() {
  const [partners, customFeatures, team, me] = await Promise.all([
    listPartners(),
    getCustomFeatures(),
    listResponsibles(),
    getCurrentUser(),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm badges={(await getBadgeSettings()).items} kind="terreno" partners={partners} customFeatures={customFeatures} team={team} currentUserId={me?.id} />
    </div>
  );
}
