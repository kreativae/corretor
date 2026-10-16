import { PartnersClient } from "@/components/crm/partners-client";
import { listPartners, listProperties } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parceiros" };

export default async function ParceirosPage() {
  const [partners, properties] = await Promise.all([listPartners(), listProperties()]);
  const partnerProps = properties
    .filter((p) => p.partnerId)
    .map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      type: p.type,
      price: p.price,
      published: p.published,
      partnerId: p.partnerId!,
      commissionPct: p.commissionPct,
      partnerSharePct: p.partnerSharePct,
      taxPct: p.taxPct,
      taxBase: p.taxBase,
      status: p.status,
    }));
  return (
    <div className="mx-auto max-w-6xl">
      <PartnersClient partners={partners} properties={partnerProps} />
    </div>
  );
}
