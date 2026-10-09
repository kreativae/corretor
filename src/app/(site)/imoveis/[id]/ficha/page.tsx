import { FichaSheet } from "./ficha-sheet";
import { PrintBar } from "./print-bar";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getSiteContent } from "@/lib/site-content";
import { TIME_ZONE } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ficha do imóvel" };

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wl, p, content] = await Promise.all([
    getWhiteLabel(),
    getPropertyByCode(id),
    getSiteContent(),
  ]);
  if (!p) notFound();

  // Corretor logado assina a ficha; visitante vê o responsável do site
  const user = await getCurrentUser();
  const broker = user
    ? { name: user.name, role: user.creci ? `Corretor · CRECI ${user.creci}` : "Corretor" }
    : {
        name: content.detail.brokerName || wl.orgName,
        role: content.detail.brokerRole || "Atendimento",
      };
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: TIME_ZONE });
  // WhatsApp do corretor logado; sem ele, o da imobiliária (white label)
  const digits = (user?.phone || wl.phone).replace(/\D/g, "");
  const phone =
    digits.length === 13
      ? `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
      : digits.length === 12
        ? `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
        : digits;

  return (
    <div className="ficha-page min-h-screen overflow-x-auto bg-neutral-200 py-8 pb-28 print:bg-white print:p-0">
      <PrintBar />
      <FichaSheet
        p={p}
        orgName={wl.orgName}
        domain={wl.domain}
        phone={phone}
        brokerName={broker.name}
        brokerRole={broker.role}
        today={today}
        logoUrl={wl.logoUrl}
        iconUrl={wl.iconUrl}
        showIcon={wl.fichaShowIcon}
        showName={wl.fichaShowName}
        showDomain={wl.fichaShowDomain}
      />
    </div>
  );
}
