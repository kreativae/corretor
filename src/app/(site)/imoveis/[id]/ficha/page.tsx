import { FichaSheet } from "./ficha-sheet";
import { getMessages } from "@/lib/features";
import { fillMessage } from "@/lib/messages";
import { FitSheet } from "./fit-sheet";
import { PrintBar } from "./print-bar";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { crmPropertyPath, isRuralType, normalizeRural, acceptsKmz } from "@/lib/rural";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSiteContent } from "@/lib/site-content";
import { formatBRL, siteImage, TIME_ZONE } from "@/lib/utils";
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
  const [wl, p, content, msgs] = await Promise.all([
    getWhiteLabel(),
    getPropertyByCode(id),
    getSiteContent(),
    getMessages(),
  ]);
  if (!p) notFound();

  // Assina a ficha o corretor responsável pelo imóvel (cadastro da equipe); sem ele, o
  // corretor logado; para o visitante, o atendimento do site
  const user = await getCurrentUser();
  const signerId = p.responsibleId ?? user?.id;
  const [signer] = signerId
    ? await (await getDb())
        .select({ name: users.name, title: users.title, creci: users.creci, phone: users.phone })
        .from(users)
        .where(eq(users.id, signerId))
    : [];
  const broker = signer
    ? {
        name: signer.name,
        role: `${signer.title?.trim() || "Corretor"}${signer.creci ? ` · CRECI ${signer.creci}` : ""}`,
      }
    : {
        name: content.detail.brokerName || wl.orgName,
        role: content.detail.brokerRole || "Atendimento",
      };
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: TIME_ZONE });
  // WhatsApp de quem assina; sem ele, o da imobiliária (white label)
  const digits = (signer?.phone || wl.phone).replace(/\D/g, "");
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
    acceptsKmz(p.type) && ruralData.kmzUrl ? "mapa" : p.published ? "contato" : null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";
  let qrSvg: string | undefined;
  let qrUrl: string | undefined;
  if (qrKind) {
    const path = qrKind === "mapa" ? "mapa" : "contato?origem=qr";
    qrUrl = `${proto}://${host}/imoveis/${p.code}/${path}`;
    qrSvg = await QRCode.toString(qrUrl, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#2B2B5DFF", light: "#FFFFFFFF" },
    });
  }

  return (
    <div className="ficha-page min-h-screen overflow-x-auto bg-[#DCDCE8] px-2 py-2 pb-28 sm:px-0 sm:py-8 print:bg-white print:p-0">
      <PrintBar
        backHref={user ? crmPropertyPath(p) : `/imoveis/${p.code}`}
        share={{
          fileName: `Ficha-${p.code}.pdf`,
          title: p.title,
          text: `${p.title} (${p.code}) — ${wl.orgName}`,
          url: `${proto}://${host}/imoveis/${p.code}`,
        }}
        kmz={
          user && acceptsKmz(p.type)
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
        logoUrl={siteImage(wl.logoUrl)}
        iconUrl={siteImage(wl.iconUrl)}
        showIcon={wl.fichaShowIcon && (!!wl.iconUrl || wl.showMark)}
        showName={wl.fichaShowName}
        showDomain={wl.fichaShowDomain}
        qrSvg={qrSvg}
        qrKind={qrKind ?? undefined}
        qrUrl={qrUrl}
        whatsappUrl={digits ? `https://wa.me/${digits.length === 10 || digits.length === 11 ? `55${digits}` : digits}?text=${encodeURIComponent(fillMessage(msgs.waFichaInterest, { codigo: p.code, titulo: p.title, preco: formatBRL(p.price) }))}` : undefined}
      />
      </FitSheet>
    </div>
  );
}
