import { RuralDetails } from "@/components/rural-details";
import { LandDetails } from "@/components/land-details";
import { landDimensions, landNumbers, normalizeLand, TOPOGRAFIA_TERRENO } from "@/lib/land";
import { getBadgeSettings, getMapOptions, getMessages } from "@/lib/features";
import { areaCenter } from "@/lib/area-center";
import { getMapProvider, tilesFor } from "@/lib/map-provider";
import { AreaLocation } from "@/components/site/area-map";
import { fillMessage } from "@/lib/messages";
import {
  APTIDAO_LABELS,
  formatAlq,
  formatHa,
  isRuralType,
  kindOf,
  normalizeRural,
  pricePerAlq,
  ruralAreas,
} from "@/lib/rural";
import { Gallery } from "@/components/site/gallery";
import { PropertyCard } from "@/components/site/property-card";
import { PropertyTracker } from "@/components/site/property-tracker";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { RevealAfter } from "@/components/site/reveal-after";
import { VisitLightbox } from "@/components/site/visit-lightbox";
import { Badge } from "@/components/ui";
import { STATUS_LABELS, STATUS_STYLES, TYPE_LABELS } from "@/lib/labels";
import {
  getPropertyByCode,
  getWhiteLabel,
  listPublishedProperties,
} from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { cn, formatBRL, initials, formatNumber, parseYouTubeUrl, siteImage } from "@/lib/utils";
import {
  BedDouble,
  Car,
  Check,
  FileDown,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Ruler,
  ShowerHead,
  Sprout,
  Trees,
  Wheat,
  Maximize2,
  Tag,
  Building2,
  Mountain,
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
  const [wl, p, published, content, msgs, mapOpts, mapCfg, badgeSettings] = await Promise.all([
    getWhiteLabel(),
    getPropertyByCode(id),
    listPublishedProperties(),
    getSiteContent(),
    getMessages(),
    getMapOptions(),
    getMapProvider(),
    getBadgeSettings(),
  ]);

  if (!p || !p.published) notFound();
  // Região no anúncio: círculo em volta do endereço cadastrado (ou do bairro); o ponto não aparece
  const area = mapOpts.areaMode === "off" ? null : await areaCenter(p);
  const tiles = tilesFor(mapCfg);

  const related = published
    .filter(
      (x) => x.id !== p.id && (x.neighborhood === p.neighborhood || x.type === p.type),
    )
    .slice(0, 3);

  const rural = isRuralType(p.type);
  const land = kindOf(p.type) === "terreno";
  const l = normalizeLand(p.land);
  const landNums = landNumbers(p.price, p.area, l);
  const r = normalizeRural(p.rural);
  const areas = ruralAreas(r);
  const specs = land
    ? [
        { icon: Ruler, label: "Área do terreno", value: `${formatNumber(p.area)} m²` },
        { icon: Maximize2, label: "Frente × fundo", value: landDimensions(l) || "—" },
        { icon: Tag, label: "Preço por m²", value: landNums.pricePerM2 ? formatBRL(landNums.pricePerM2) : "—" },
        landNums.buildable
          ? { icon: Building2, label: "Área construível", value: `${formatNumber(landNums.buildable)} m²` }
          : { icon: Mountain, label: "Topografia", value: l.topografia ? TOPOGRAFIA_TERRENO[l.topografia].replace(/ \(.*\)$/, "") : "—" },
      ]
    : rural
    ? [
        { icon: Ruler, label: `Área total · ${formatHa(areas.total)} ha`, value: `${formatAlq(areas.total)} alq` },
        { icon: Sprout, label: "Aptidão", value: r.aptidao ? APTIDAO_LABELS[r.aptidao] : "—" },
        { icon: Wheat, label: "Área plantada", value: `${formatAlq(areas.plantada)} alq` },
        { icon: Trees, label: "Reserva legal", value: `${formatAlq(areas.reserva)} alq` },
      ]
    : [
        { icon: Ruler, label: "Área", value: `${formatNumber(p.area)} m²` },
        { icon: BedDouble, label: "Quartos", value: p.bedrooms },
        { icon: ShowerHead, label: "Banheiros", value: p.bathrooms },
        { icon: Car, label: "Vagas", value: p.garage },
      ];

  const waText = encodeURIComponent(
    fillMessage(msgs.waSiteInterest, { codigo: p.code, titulo: p.title, preco: formatBRL(p.price) }),
  );

  return (
    <div>
      <PropertyTracker propertyId={p.id} />
      <SiteHeader orgName={wl.orgName} menu={content.header} hasRural={published.some((x) => isRuralType(x.type))} hasLand={published.some((x) => kindOf(x.type) === "terreno")} />
      <main className="container-x pb-32 pt-24 md:pt-32 lg:pb-24">
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
              {/* Sem rua e número: o endereço exato é informado pelo corretor */}
              {p.neighborhood} — {p.city}/{p.state}
            </p>
          </div>
          <div data-reveal className="flex flex-wrap items-center gap-2">
            {(() => {
              // Mesmo selo do card (a lista pública já vem com ele resolvido)
              const b = published.find((x) => x.id === p.id)?.badgeView;
              return b && badgeSettings.onDetail ? (
                <span className="rounded-full px-3 py-1 text-xs font-semibold shadow-sm" style={{ background: b.bg, color: b.fg }}>
                  {b.label}
                </span>
              ) : null;
            })()}
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
            images={p.images.map((i) => siteImage(i.url, p.wm))}
            title={p.title}
            videoId={parseYouTubeUrl(p.videoUrl)}
            videoWatermark={`/api/watermark/overlay?wm=${p.wm}`}
          />
        </div>

        <div className="mt-8 grid gap-10 md:mt-12 md:gap-12 lg:grid-cols-[1fr_370px]">
          {/* Coluna principal */}
          <div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4">
              {specs.map((s) => (
                <div key={s.label} className="bg-card p-4 md:p-5">
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
                <h2 className="mt-10 font-display text-xl font-semibold tracking-tight md:mt-12 md:text-2xl">
                  {land ? "Sobre o terreno" : "Sobre o imóvel"}
                </h2>
                <p className="mt-5 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-subtle">
                  {p.description.replace(/\n{3,}/g, "\n\n").trim()}
                </p>
              </>
            )}

            {/* Terreno com KMZ: atalho para o perímetro no mapa */}
            {!rural && r.kmzUrl && (
              <Link
                href={`/imoveis/${p.code}/mapa`}
                target="_blank"
                className="mt-8 flex items-center gap-3 rounded-2xl border border-hairline bg-card p-4 transition-colors hover:bg-soft md:p-5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <MapIcon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Ver perímetro do terreno no mapa</span>
                  <span className="block text-xs text-subtle">Imagem de satélite e download do KMZ</span>
                </span>
              </Link>
            )}

            {land && (
              <>
                <h2 className="mt-10 font-display text-xl font-semibold tracking-tight md:mt-12 md:text-2xl">
                  O terreno
                </h2>
                <div className="mt-5 rounded-2xl border border-hairline bg-card p-4 md:p-6">
                  <LandDetails l={l} area={p.area} price={p.price} hideHighlights />
                </div>
              </>
            )}

            {rural && (
              <>
                <h2 className="mt-10 font-display text-xl font-semibold tracking-tight md:mt-12 md:text-2xl">
                  A propriedade
                </h2>
                <div className="mt-5 rounded-2xl border border-hairline bg-card p-4 md:p-6">
                  <RuralDetails r={r} mapHref={`/imoveis/${p.code}/mapa`} />
                </div>
              </>
            )}

            {p.features.length > 0 && (
              <>
                <h2 className="mt-10 font-display text-xl font-semibold tracking-tight md:mt-12 md:text-2xl">
                  {land ? "No condomínio" : "Comodidades"}
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

            {p.notes?.trim() && (
              <>
                <h2 className="mt-10 font-display text-xl font-semibold tracking-tight md:mt-12 md:text-2xl">
                  Observações
                </h2>
                <p className="mt-5 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-subtle">
                  {p.notes.replace(/\n{3,}/g, "\n\n").trim()}
                </p>
              </>
            )}

            <h2 className="mt-10 font-display text-xl font-semibold tracking-tight md:mt-12 md:text-2xl">
              Localização
            </h2>
            {/* Região aproximada (círculo), nunca o endereço exato; sem link para o Google Maps */}
            <AreaLocation
              neighborhood={p.neighborhood}
              place={`${p.city}, ${p.state} — Brasil`}
              center={area}
              radiusKm={mapOpts.areaRadiusKm}
              zoom={mapOpts.areaZoom}
              tiles={tiles}
              mode={mapOpts.areaMode}
            />
          </div>

          {/* Sidebar */}
          {/* No celular, o preço vem logo depois das fotos */}
          <aside className="order-first lg:sticky lg:top-[calc(7rem+var(--adminbar,0px))] lg:order-none lg:self-start">
            <div className="rounded-2xl border border-hairline bg-card p-5 md:p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
                {p.code} · {TYPE_LABELS[p.type]}
              </p>
              <p className="mt-3 font-mono text-2xl font-medium tabular tracking-tight md:text-3xl">
                {formatBRL(p.price)}
                {p.purpose === "aluguel" && (
                  <span className="text-base text-subtle"> /mês</span>
                )}
              </p>
              <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
                {rural && pricePerAlq(p.price, r.totalAlq) != null && (
                  <div className="flex justify-between text-subtle">
                    <span>Por alqueire</span>
                    <span className="font-mono tabular text-ink">
                      {formatBRL(pricePerAlq(p.price, r.totalAlq))}
                    </span>
                  </div>
                )}
                {land && landNums.pricePerM2 != null && (
                  <div className="flex justify-between text-subtle">
                    <span>Por m²</span>
                    <span className="font-mono tabular text-ink">{formatBRL(landNums.pricePerM2)}</span>
                  </div>
                )}
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
                  {initials(content.detail.brokerName || wl.orgName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {content.detail.brokerName || wl.orgName}
                  </p>
                  <p className="text-[11px] text-subtle">
                    {content.detail.brokerRole || "Atendimento exclusivo"}
                  </p>
                </div>
              </div>

              <div id="acoes-imovel" className="mt-5 grid gap-2">
                <a href="#agendar">
                  <span className="flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-canvas transition-opacity duration-300 hover:opacity-85">
                    {content.visit.cta}
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

        {/* Agendamento: oculto na página, abre em janela pelos botões "#agendar" */}
        <VisitLightbox
          propertyId={p.id}
          propertyCode={p.code}
          propertyTitle={p.title}
          eyebrow={content.detail.visitEyebrow}
          title={content.detail.visitTitle}
          bullets={content.detail.visitBullets}
          texts={content.visit}
        />

        {/* Relacionados */}
        {related.length > 0 && (
          <section className="mt-14 border-t border-hairline pt-12 md:mt-20 md:pt-16">
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

      {/* Celular: barra fixa com preço e contato — aparece depois de rolar além dos botões de ação */}
      <RevealAfter targetId="acoes-imovel" className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <div className="border-t border-hairline bg-canvas/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
                {p.code} · {p.purpose === "venda" ? "Venda" : "Aluguel"}
              </p>
              <p className="truncate font-mono text-base font-medium tabular">
                {formatBRL(p.price)}
                {p.purpose === "aluguel" && <span className="text-xs text-subtle"> /mês</span>}
              </p>
            </div>
            <a
              href={`/imoveis/${p.code}/ficha`}
              target="_blank"
              rel="noreferrer"
              aria-label="Ficha em PDF"
              title="Ficha em PDF"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline-strong text-ink"
            >
              <FileDown className="size-5" />
            </a>
            <a
              href={`https://wa.me/${wl.phone}?text=${waText}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
            >
              <MessageCircle className="size-5" />
            </a>
            <a
              href="#agendar"
              className="flex h-11 shrink-0 items-center justify-center rounded-full bg-ink px-4 text-sm font-medium text-canvas min-[400px]:px-5"
            >
              {content.visit.cta}
            </a>
          </div>
        </div>
      </RevealAfter>

      <SiteFooter
        orgName={wl.orgName}
        phone={wl.phone}
        footer={content.footer}
        cta={content.cta}
        email={wl.email}
        instagram={wl.instagram}
      />
      {/* Espaço para a barra fixa do celular não cobrir o rodapé */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
