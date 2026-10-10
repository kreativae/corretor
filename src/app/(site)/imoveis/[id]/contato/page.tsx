import { LeadForm } from "@/components/site/lead-form";
import { Wordmark } from "@/components/brand";
import { TYPE_LABELS } from "@/lib/labels";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import { formatBRL, formatNumber } from "@/lib/utils";
import { ArrowUpRight, MessageCircle } from "lucide-react";
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
  return {
    title: p ? `Fale com um consultor · ${p.code}` : "Fale com um consultor",
    robots: { index: false },
  };
}

/**
 * Destino do QR code da ficha: formulário enxuto, já vinculado ao imóvel.
 * `?origem=qr` registra no CRM que o contato veio da ficha impressa.
 */
export default async function ContatoImovelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origem?: string }>;
}) {
  const [{ id }, { origem }] = await Promise.all([params, searchParams]);
  const [p, wl] = await Promise.all([getPropertyByCode(id), getWhiteLabel()]);
  if (!p || !p.published) notFound();

  const rural = isRuralType(p.type);
  const size = rural
    ? `${formatAlq(normalizeRural(p.rural).totalAlq ?? 0)} alq`
    : `${formatNumber(p.area)} m²${p.bedrooms ? ` · ${p.bedrooms} ${p.bedrooms === 1 ? "quarto" : "quartos"}` : ""}`;
  const wa = wl.phone
    ? `https://wa.me/${wl.phone}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${p.code} — ${p.title}.`)}`
    : null;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="container-x flex h-16 items-center justify-between">
        <Link href="/" aria-label={wl.orgName}>
          <Wordmark />
        </Link>
      </header>

      <main className="container-x max-w-2xl pb-16 pt-4">
        {/* Imóvel */}
        <div className="overflow-hidden rounded-3xl border border-hairline bg-card">
          {p.cover && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={p.cover} alt={p.title} className="aspect-[16/9] w-full object-cover" />
          )}
          <div className="flex flex-wrap items-end justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
                {p.code} · {TYPE_LABELS[p.type]}
              </p>
              <h1 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-tight">
                {p.title}
              </h1>
              <p className="mt-1 text-sm text-subtle">
                {p.neighborhood}, {p.city}/{p.state} · {size}
              </p>
            </div>
            <p className="font-mono text-xl font-medium tabular">{formatBRL(p.price)}</p>
          </div>
        </div>

        {/* Formulário */}
        <section className="mt-6 rounded-3xl border border-hairline bg-card p-5 md:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">
            Fale com um consultor
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            Quer saber mais sobre este imóvel?
          </h2>
          <p className="mb-6 mt-2 text-sm text-subtle">
            Deixe seu contato e um consultor responde pelo WhatsApp.
          </p>
          <LeadForm
            property={{ id: p.id, code: p.code, title: p.title }}
            origin={origem === "qr" ? "qr" : "site"}
          />
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-subtle transition-colors hover:text-ink"
            >
              <MessageCircle className="size-4" />
              Prefiro chamar no WhatsApp
            </a>
          )}
          <Link
            href={`/imoveis/${p.code}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-subtle transition-colors hover:text-ink"
          >
            Ver fotos e detalhes
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
