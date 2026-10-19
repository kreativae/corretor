import { KmzMap } from "@/components/kmz-map";
import { getMapOptions } from "@/lib/features";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { formatAlq, formatHa, isRuralType, normalizeRural, acceptsKmz } from "@/lib/rural";
import { formatBRL } from "@/lib/utils";
import { kmzAccess } from "@/lib/kmz-lock";
import { ArrowLeft, Download, Lock } from "lucide-react";
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
export default async function MapaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const [p, wl, mapOpts] = await Promise.all([
    getPropertyByCode(id),
    getWhiteLabel(),
    getMapOptions(),
  ]);
  if (!p || !acceptsKmz(p.type)) notFound();
  const r = normalizeRural(p.rural);
  if (!r.kmzUrl) notFound();
  // Senha definida no cadastro do imóvel: pede antes de mostrar o mapa e liberar o download
  const locked = (await kmzAccess(p.id)) === "locked";
  // O mapa lê o arquivo pelo link do site, que confere a senha (o endereço direto é só da equipe)
  const fileUrl = `/imoveis/${p.code}/kmz`;

  return (
    <div className="flex h-[calc(100dvh-var(--site-safe,env(safe-area-inset-top)))] flex-col bg-neutral-950 text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 pb-3 pt-3 sm:px-4">
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
            {r.totalAlq ? `${formatAlq(r.totalAlq)} alq (${formatHa(r.totalAlq)} ha) · ` : ""}
            {p.city}/{p.state}
            <span className="hidden sm:inline"> · {formatBRL(p.price)} · {p.code}</span>
          </p>
        </div>
        {!locked && <a
          href={fileUrl}
          download={r.kmzName || `${p.code}.kmz`}
          aria-label="Baixar KMZ"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-neutral-900 sm:px-4"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Baixar KMZ</span>
          <span className="sm:hidden">KMZ</span>
        </a>}
      </header>
      {locked ? (
        <form
          method="post"
          action={`/imoveis/${p.code}/mapa/desbloquear`}
          className="m-auto flex w-full max-w-xs flex-col items-center px-6 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
            <Lock className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">Mapa protegido</h1>
          <p className="mt-1.5 text-sm text-white/60">
            Digite a senha que o corretor enviou para ver o perímetro e baixar o KMZ.
          </p>
          <input
            name="senha"
            type="password"
            required
            autoFocus
            autoComplete="off"
            placeholder="Senha"
            aria-label="Senha do mapa"
            className="mt-5 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-center text-base outline-none placeholder:text-white/40 focus:border-white/40"
          />
          {erro && <p className="mt-2 text-sm text-red-400">Senha incorreta. Confira com o corretor.</p>}
          <button className="mt-3 h-11 w-full rounded-xl bg-white text-sm font-semibold text-neutral-900">
            Ver mapa
          </button>
          <Link href={`/imoveis/${p.code}`} className="mt-4 text-xs text-white/50 hover:text-white/80">
            Voltar ao anúncio
          </Link>
        </form>
      ) : (
        <KmzMap
          url={`${fileUrl}?inline=1`}
          className="min-h-0 flex-1"
          showLocate={mapOpts.locate}
          showDirections={mapOpts.directions}
        />
      )}
      <footer className="hidden shrink-0 px-4 py-2.5 text-center text-[11px] text-white/40 sm:block">
        {wl.orgName} · O arquivo KMZ abre no Google Earth (celular ou computador)
      </footer>
    </div>
  );
}
