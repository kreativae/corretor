import { KmzMap } from "@/components/kmz-map";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { formatAlq, formatHa, isRuralType, normalizeRural } from "@/lib/rural";
import { formatBRL } from "@/lib/utils";
import { ArrowLeft, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getPropertyByCode(id);
  return { title: p ? `Mapa · ${p.title}` : "Mapa" };
}

/** Destino do QR code da ficha: perímetro do KMZ em satélite + download. */
export default async function MapaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, wl] = await Promise.all([getPropertyByCode(id), getWhiteLabel()]);
  if (!p || !isRuralType(p.type)) notFound();
  const r = normalizeRural(p.rural);
  if (!r.kmzUrl) notFound();

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-white">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link
          href={`/imoveis/${p.code}`}
          aria-label="Ver anúncio"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.title}</p>
          <p className="truncate font-mono text-[11px] text-white/50">
            {p.code} · {r.totalAlq ? `${formatAlq(r.totalAlq)} alq (${formatHa(r.totalAlq)} ha) · ` : ""}
            {p.city}/{p.state} · {formatBRL(p.price)}
          </p>
        </div>
        <a
          href={r.kmzUrl}
          download={r.kmzName || `${p.code}.kmz`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900"
        >
          <Download className="size-3.5" />
          Baixar KMZ
        </a>
      </header>
      <KmzMap url={r.kmzUrl} className="min-h-0 flex-1" />
      <footer className="shrink-0 px-4 py-2.5 text-center text-[11px] text-white/40">
        {wl.orgName} · O arquivo KMZ abre no Google Earth (celular ou computador)
      </footer>
    </div>
  );
}
