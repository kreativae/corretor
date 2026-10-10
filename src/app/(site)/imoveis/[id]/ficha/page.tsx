import { FichaSheet } from "./ficha-sheet";
import { FitSheet } from "./fit-sheet";
import { PrintBar } from "./print-bar";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { crmPropertyPath, isRuralType, normalizeRural } from "@/lib/rural";
import { headers } from "next/headers";
import QRCode from "qrcode";
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

  // QR code, no domínio em que a ficha foi aberta:
  // rural com KMZ → mapa do perímetro; demais → "Fale com um consultor"
  const rural = isRuralType(p.type);
  const ruralData = normalizeRural(p.rural);
  const qrKind: "mapa" | "contato" | null =
    rural && ruralData.kmzUrl ? "mapa" : p.published ? "contato" : null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";
  let qrSvg: string | undefined;
  if (qrKind) {
    const path = qrKind === "mapa" ? "mapa" : "contato?origem=qr";
    qrSvg = await QRCode.toString(`${proto}://${host}/imoveis/${p.code}/${path}`, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
    });
  }

  return (
    <div className="ficha-page min-h-screen overflow-x-auto bg-neutral-200 px-2 py-2 pb-28 sm:px-0 sm:py-8 print:bg-white print:p-0">
      <PrintBar
        backHref={user ? crmPropertyPath(p) : `/imoveis/${p.code}`}
        share={{
          fileName: `Ficha-${p.code}.pdf`,
          title: p.title,
          text: `${p.title} (${p.code}) — ${wl.orgName}`,
          url: `${proto}://${host}/imoveis/${p.code}`,
        }}
        kmz={
          user && rural
            ? { propertyId: p.id, type: p.type, rural: ruralData }
            : undefined
        }
      />
      <FitSheet>
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
        qrSvg={qrSvg}
        qrKind={qrKind ?? undefined}
      />
      </FitSheet>
    </div>
  );
}
