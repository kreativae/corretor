import { Gallery } from "@/components/site/gallery";
import { PropertyCard } from "@/components/site/property-card";
import { PropertyTracker } from "@/components/site/property-tracker";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { VisitForm } from "@/components/site/visit-form";
import { Badge } from "@/components/ui";
import { STATUS_LABELS, STATUS_STYLES, TYPE_LABELS } from "@/lib/labels";
import {
  getPropertyByCode,
  getWhiteLabel,
  listPublishedProperties,
} from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { cn, formatBRL, initials, formatNumber } from "@/lib/utils";
import {
  BedDouble,
  Car,
  Check,
  FileDown,
  MapPin,
  MessageCircle,
  Ruler,
  ShowerHead,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const p = await getPropertyByCode(id);
  if (!p) return {};
  return {
    title: `${p.title} — ${p.neighborhood}`,
    description: `${TYPE_LABELS[p.type]} com ${formatNumber(p.area)} m², ${p.bedrooms} quartos em ${p.neighborhood}, ${p.city}. ${formatBRL(p.price)}.`,
  };
}

export default async function ImovelPage({ params }: { params: Params }) {
  const { id } = await params;
  const [wl, p, published, content] = await Promise.all([
    getWhiteLabel(),
    getPropertyByCode(id),
    listPublishedProperties(),
    getSiteContent(),
  ]);

  if (!p || !p.published) notFound();

  const related = published
    .filter(
      (x) => x.id !== p.id && (x.neighborhood === p.neighborhood || x.type === p.type),
    )
    .slice(0, 3);

  const specs = [
    { icon: Ruler, label: "Área", value: `${formatNumber(p.area)} m²` },
    { icon: BedDouble, label: "Quartos", value: p.bedrooms },
    { icon: ShowerHead, label: "Banheiros", value: p.bathrooms },
    { icon: Car, label: "Vagas", value: p.garage },
  ];

  const waText = encodeURIComponent(
    `Olá! Tenho interesse no imóvel ${p.code} — ${p.title} (${formatBRL(p.price)}). Podemos conversar?`,
  );

  return (
    <div>
      <PropertyTracker propertyId={p.id} />
      <SiteHeader orgName={wl.orgName} />
      <main className="container-x pb-24 pt-24 md:pt-32">
        {/* Breadcrumb + título */}
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
          <Link href="/imoveis" className="transition-colors hover:text-ink">
            Portfólio
          </Link>
          <span className="mx-2">/</span>
          {p.code}
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1
              data-words
              className="text-balance font-display text-3xl font-semibold tracking-[-0.02em] md:text-5xl"
            >
              {p.title}
            </h1>
            <p data-reveal className="mt-3 flex items-center gap-1.5 text-sm text-subtle">
              <MapPin className="size-4" />
              {p.street ? `${p.street}, ` : ""}
              {p.neighborhood} — {p.city}/{p.state}
            </p>
          </div>
          <div data-reveal className="flex items-center gap-2">
            <Badge className={cn("border", STATUS_STYLES[p.status])}>
              {STATUS_LABELS[p.status]}
            </Badge>
            <Badge className="border-transparent bg-accent text-on-accent">
              {p.purpose === "venda" ? "Venda" : "Aluguel"}
            </Badge>
          </div>
        </div>

        {/* Galeria */}
        <div data-reveal className="mt-8">
          <Gallery
            images={p.images.map((i) => i.url)}
            title={p.title}
          />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_370px]">
          {/* Coluna principal */}
          <div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4">
              {specs.map((s) => (
                <div key={s.label} className="bg-card p-5">
                  <s.icon className="size-4.5 text-subtle" />
                  <p className="mt-3 font-mono text-lg font-medium tabular">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">{s.label}</p>
                </div>
              ))}
            </div>

            {p.description && (
              <>
                <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
                  Sobre o imóvel
                </h2>
                <p className="mt-4 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-subtle">
                  {p.description}
                </p>
              </>
            )}

            {p.features.length > 0 && (
              <>
                <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
                  Comodidades
                </h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {p.features.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3.5 py-2 text-xs font-medium"
                    >
                      <Check className="size-3.5 text-accent" />
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}

            <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
              Localização
            </h2>
            <div className="grid-bg relative mt-5 overflow-hidden rounded-2xl border border-hairline p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{p.neighborhood}</p>
                  <p className="mt-1 text-sm text-subtle">
                    {p.city}, {p.state} — Brasil
                  </p>
                  {p.lat && p.lng && (
                    <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-subtle">
                      {p.lat.toFixed(4)}° S · {Math.abs(p.lng).toFixed(4)}° W
                    </p>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.neighborhood}, ${p.city}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-hairline-strong px-4 py-2 text-xs font-medium transition-colors hover:bg-card"
                >
                  Abrir no Maps
                </a>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-hairline bg-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
                {p.code} · {TYPE_LABELS[p.type]}
              </p>
              <p className="mt-3 font-mono text-3xl font-medium tabular tracking-tight">
                {formatBRL(p.price)}
                {p.purpose === "aluguel" && (
                  <span className="text-base text-subtle"> /mês</span>
                )}
              </p>
              <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
                {p.condoFee != null && (
                  <div className="flex justify-between text-subtle">
                    <span>Condomínio</span>
                    <span className="font-mono tabular text-ink">
                      {formatBRL(p.condoFee)}
                    </span>
                  </div>
                )}
                {p.iptu != null && (
                  <div className="flex justify-between text-subtle">
                    <span>IPTU /ano</span>
                    <span className="font-mono tabular text-ink">
                      {formatBRL(p.iptu)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl bg-soft p-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-canvas">
                  {initials(content.detail.brokerName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {content.detail.brokerName}
                  </p>
                  <p className="text-[11px] text-subtle">
                    {content.detail.brokerRole}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                <a href="#agendar">
                  <span className="flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-canvas transition-opacity duration-300 hover:opacity-85">
                    Agendar visita
                  </span>
                </a>
                <a href={`https://wa.me/${wl.phone}?text=${waText}`} target="_blank" rel="noreferrer">
                  <span className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-on-accent transition-all duration-300 hover:brightness-110">
                    <MessageCircle className="size-4" />
                    WhatsApp direto
                  </span>
                </a>
                <a href={`/imoveis/${p.code}/ficha`} target="_blank" rel="noreferrer">
                  <span className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-hairline text-sm font-medium transition-colors duration-300 hover:bg-soft">
                    <FileDown className="size-4" />
                    Ficha em PDF
                  </span>
                </a>
              </div>
            </div>
          </aside>
        </div>

        {/* Agendamento */}
        <section id="agendar" className="mt-20 grid gap-10 border-t border-hairline pt-16 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">
              {content.detail.visitEyebrow}
            </p>
            <h2
              data-words
              className="mt-3 text-balance font-display text-3xl font-semibold tracking-[-0.02em] md:text-5xl"
            >
              {content.detail.visitTitle}
            </h2>
            <ul className="mt-8 space-y-4">
              {content.detail.visitBullets.filter(Boolean).map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-subtle">
                  <Sparkles className="size-4 shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <VisitForm propertyId={p.id} propertyCode={p.code} />
        </section>

        {/* Relacionados */}
        {related.length > 0 && (
          <section className="mt-20 border-t border-hairline pt-16">
            <div className="mb-10 flex items-end justify-between">
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                Na mesma régua
              </h2>
              <Link
                href="/imoveis"
                className="text-sm font-medium text-subtle transition-colors hover:text-ink"
              >
                Ver todos →
              </Link>
            </div>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <PropertyCard key={r.id} property={r} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter orgName={wl.orgName} phone={wl.phone} footer={content.footer} />
    </div>
  );
}
