import { NegotiationClient, type NegProperty } from "@/components/crm/negotiation-client";
import { getCurrentUser } from "@/lib/auth";
import { emailConfigured } from "@/lib/notify";
import { getMessages } from "@/lib/features";
import { listContacts, listProperties, listPropertySends } from "@/lib/queries";
import { formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import { formatNumber } from "@/lib/utils";
import { lineFor, whatsappReady } from "@/lib/whatsapp";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Negociação" };

export default async function NegociacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ contato?: string; imoveis?: string }>;
}) {
  const [sp, user, contacts, properties, sends, msgs] = await Promise.all([
    searchParams,
    getCurrentUser(),
    listContacts(),
    listProperties(),
    listPropertySends(),
    getMessages(),
  ]);

  const wa = user ? await lineFor(user.id).catch(() => null) : null;

  const props: NegProperty[] = properties.map((p) => {
    const r = isRuralType(p.type) ? normalizeRural(p.rural) : null;
    return {
      id: p.id,
      code: p.code,
      title: p.title,
      type: p.type,
      purpose: p.purpose,
      status: p.status,
      price: p.price,
      city: p.city,
      neighborhood: p.neighborhood,
      cover: p.cover,
      published: p.published,
      specs: r
        ? r.totalAlq
          ? `${formatAlq(r.totalAlq)} alq`
          : ""
        : [p.bedrooms ? `${p.bedrooms} qts` : "", p.area ? `${formatNumber(p.area)} m²` : ""].filter(Boolean).join(" · "),
    };
  });

  return (
    <div className="mx-auto max-w-6xl">
      <NegotiationClient
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          interestTypes: c.interestTypes,
          budgetMax: c.budgetMax,
          neighborhoods: c.neighborhoods,
        }))}
        properties={props}
        sends={sends}
        emailReady={await emailConfigured()}
        waReady={!!wa && whatsappReady(wa)}
        waQr={wa?.provider === "evolution"}
        userName={user?.name ?? ""}
        msgs={msgs}
        initialContactId={sp.contato}
        initialIds={sp.imoveis?.split(",").filter(Boolean)}
      />
    </div>
  );
}
