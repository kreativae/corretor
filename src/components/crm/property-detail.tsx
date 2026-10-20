import { RuralDetails } from "@/components/rural-details";
import { LandDetails } from "@/components/land-details";
import { landDimensions, landNumbers, normalizeLand } from "@/lib/land";
import { getKmzPassword } from "@/lib/kmz-lock";
import { DetailTabs } from "@/components/crm/detail-tabs";
import { commissionValues } from "@/lib/partners";
import { CommissionBreakdown } from "@/components/crm/commission-breakdown";
import { getMessages } from "@/lib/features";
import { fillMessage } from "@/lib/messages";
import {
  APTIDAO_LABELS,
  crmPropertyPath,
  formatAlq,
  formatHa,
  formatPct,
  CRM_SECTION,
  kindOf,
  normalizeRural,
  pricePerAlq,
  ruralAreas, acceptsKmz } from "@/lib/rural";
import { AdExporterModal } from "@/components/crm/ad-exporter-modal";
import { DuplicatePropertyButton } from "@/components/crm/duplicate-property-button";
import { PortalPanel } from "@/components/crm/portal-panel";
import { PropertyDocuments } from "@/components/crm/property-documents";
import { isLocalStorage } from "@/lib/blob";
import { Timeline } from "@/components/crm/timeline";
import { Badge, Button } from "@/components/ui";
import { getPropertyViewStats, getWhiteLabel, getPartner } from "@/lib/queries";
import { compareToRegion } from "@/lib/market-data";
import { MIN_SAMPLES } from "@/lib/market";
import {
  PURPOSE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_STYLES,
} from "@/lib/labels";
import {
  getPropertyById,
  listActivitiesFor,
  listPortals,
  listPropertyDocuments,
  listVisits,
} from "@/lib/queries";
import { cn, formatBRL, formatDateTime, timeAgo, formatNumber, formatPhone } from "@/lib/utils";
import {
  ArrowLeft,
  BedDouble,
  Car,
  Check,
  FileDown,
  Globe,
  Lock,
  Map as MapIcon,
  MessageCircle,
  Pencil,
  Ruler,
  ShowerHead,
  Sprout,
  Trees,
  Wheat,
  Handshake,
  Maximize2,
  Building2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/** Detalhe do imóvel no CRM — usado por /crm/imoveis/[id] e /crm/propriedades/[id]. */
export async function PropertyDetail({
  id,
  section,
}: {
  id: string;
  section: "imoveis" | "propriedades" | "terrenos";
}) {
  const [p, portals, allVisits, wl] = await Promise.all([
    getPropertyById(id),
    listPortals(),
    listVisits(),
    getWhiteLabel(),
  ]);
  if (!p) notFound();
  // Rurais vivem em /crm/propriedades, terrenos em /crm/terrenos e urbanos em /crm/imoveis
  if (CRM_SECTION[kindOf(p.type)] !== section) redirect(crmPropertyPath(p));

  const kmzPassword = acceptsKmz(p.type) ? await getKmzPassword(p.id) : null;
  const [activities, views, documents, partner, msgs, market] = await Promise.all([
    listActivitiesFor("imovel", p.id, 60),
    getPropertyViewStats(p.id),
    listPropertyDocuments(p.id),
    p.partnerId ? getPartner(p.partnerId) : null,
    getMessages(),
    compareToRegion(p).catch(() => null),
  ]);
  const commission = commissionValues(p.price, p.commissionPct, p.partnerSharePct);
  const propertyVisits = allVisits.filter((v) => v.property?.id === p.id);

  const rural = kindOf(p.type) === "rural";
  const land = kindOf(p.type) === "terreno";
  const l = normalizeLand(p.land);
  const landNums = landNumbers(p.price, p.area, l);
  const r = normalizeRural(p.rural);
  const areas = ruralAreas(r);
  const specs = rural
    ? [
        { icon: Ruler, label: `Área total · ${formatHa(areas.total)} ha`, value: `${formatAlq(areas.total)} alq` },
        { icon: Sprout, label: "Aptidão", value: r.aptidao ? APTIDAO_LABELS[r.aptidao] : "—" },
        { icon: Wheat, label: "Área plantada", value: `${formatAlq(areas.plantada)} alq` },
        { icon: Trees, label: "Reserva legal", value: formatPct(areas.reservaPct) },
      ]
    : land
      ? [
          { icon: Ruler, label: "Área do terreno", value: `${formatNumber(p.area)} m²` },
          { icon: Maximize2, label: "Medidas", value: landDimensions(l) || "—" },
          { icon: Building2, label: "Área construível", value: landNums.buildable ? `${formatNumber(landNums.buildable)} m²` : "—" },
          { icon: Sparkles, label: "Vantagens", value: l.vantagens.length },
        ]
      : [
        { icon: Ruler, label: "Área", value: `${formatNumber(p.area)} m²` },
        { icon: BedDouble, label: "Quartos", value: p.bedrooms },
        { icon: ShowerHead, label: "Banheiros", value: p.bathrooms },
        { icon: Car, label: "Vagas", value: p.garage },
      ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cabeçalho */}
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <Link
            href={`/crm/${section}`}
            className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:bg-soft hover:text-ink"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
              {p.code} · {TYPE_LABELS[p.type]} · {PURPOSE_LABELS[p.purpose]}
            </p>
            <h1 className="mt-1.5 text-balance font-display text-2xl font-semibold tracking-tight md:text-4xl">
              {p.title}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge className={cn("border", STATUS_STYLES[p.status])}>
                {STATUS_LABELS[p.status]}
              </Badge>
              <Badge
                className={cn(
                  "border",
                  p.published
                    ? "border-[#2B2B5D]/20 bg-[#2B2B5D]/[0.07] text-[#2B2B5D] dark:border-white/15 dark:bg-white/10 dark:text-white"
                    : "border-hairline bg-soft text-subtle",
                )}
              >
                {p.published ? "Publicado no site" : "Fora da vitrine"}
              </Badge>
            </div>
          </div>
        </div>
        {/* Ações de fora a fora (da Visão geral até o preço): o título fica livre para ocupar a largura */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:[&>a]:flex-1 sm:[&>button]:flex-1 [&>a>button]:w-full [&>button]:w-full">
          <AdExporterModal property={p} whiteLabel={wl} />
          <Link href={crmPropertyPath(p, "/editar")}>
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" />
              Editar
            </Button>
          </Link>
          <DuplicatePropertyButton id={p.id} code={p.code} />
          <Link href={`/imoveis/${p.code}`} target="_blank">
            <Button variant="outline" size="sm">
              <Globe className="size-3.5" />
              Ver no site
            </Button>
          </Link>
          <Link href={`/imoveis/${p.code}/ficha`} target="_blank">
            <Button variant="outline" size="sm">
              <FileDown className="size-3.5" />
              Ficha PDF
            </Button>
          </Link>
          {acceptsKmz(p.type) && r.kmzUrl && (
            <Link href={`/imoveis/${p.code}/mapa`} target="_blank" title={kmzPassword ? `Mapa protegido · senha ${kmzPassword}` : undefined}>
              <Button variant="outline" size="sm">
                {kmzPassword ? <Lock className="size-3.5" /> : <MapIcon className="size-3.5" />}
                Mapa
                {kmzPassword && <span className="font-mono text-[11px] text-subtle">· senha {kmzPassword}</span>}
              </Button>
            </Link>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(fillMessage(msgs.waShare, { codigo: p.code, titulo: p.title, preco: formatBRL(p.price) }))}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="accent" size="sm">
              <MessageCircle className="size-3.5" />
              WhatsApp
            </Button>
          </a>
        </div>
      </div>

      {/* Abas no conteúdo principal; lateral fixa com preço e últimas atividades */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          {/* Preço — no celular logo depois das fotos */}
          <div className="rounded-2xl border border-hairline bg-card p-4 md:p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
              {p.purpose === "aluguel" ? "Aluguel" : "Venda"}
            </p>
            <p className="mt-2 font-mono text-2xl font-medium tabular tracking-tight">
              {formatBRL(p.price)}
            </p>
            <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
              {(rural
                ? [["Por alqueire", pricePerAlq(p.price, r.totalAlq)]]
                : land
                  ? [
                      ["Por m²", landNums.pricePerM2],
                      ["Condomínio", p.condoFee],
                      ["IPTU /ano", p.iptu],
                    ]
                  : [
                    ["Condomínio", p.condoFee],
                    ["IPTU /ano", p.iptu],
                    ["Terreno", p.lotArea ? `${formatNumber(p.lotArea)} m²` : null],
                    ["Suítes", p.suites ? String(p.suites) : null],
                  ])
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-subtle">
                    <span>{k}</span>
                    <span className="font-mono tabular text-ink">
                      {typeof v === "number" ? formatBRL(v) : v}
                    </span>
                  </div>
                ))}
            </div>
            {market && (
              <Link
                href="/crm/valor-m2"
                className="mt-4 block rounded-xl border border-hairline p-3.5 text-xs leading-relaxed transition-colors hover:bg-soft"
                title="Comparado com anúncios, negócios fechados e amostras dos últimos 24 meses"
              >
                <p className="text-subtle">
                  {formatBRL(Math.round(market.own))}
                  {market.unit === "alq" ? "/alq" : "/m²"} · mediana {rural ? "do município" : "do bairro"}{" "}
                  {formatBRL(Math.round(market.median))}
                </p>
                <p className="mt-1 font-medium text-ink">
                  {Math.abs(market.diffPct) < 1
                    ? `Na mediana de ${market.region}`
                    : `${Math.abs(market.diffPct).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% ${market.diffPct > 0 ? "acima" : "abaixo"} da mediana de ${market.region}`}
                </p>
                <p className="mt-0.5 text-[11px] text-subtle">
                  {market.n} {market.n === 1 ? "amostra" : "amostras"}
                  {market.n < MIN_SAMPLES ? " · poucas amostras, use só como indício" : ""}
                </p>
              </Link>
            )}
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-subtle">
              Criado {timeAgo(p.createdAt)} · Atualizado {timeAgo(p.updatedAt)}
            </p>
          </div>

          {/* Últimas atividades (completo na aba Histórico) */}
          <div className="rounded-2xl border border-hairline bg-card p-4 md:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-sm font-semibold tracking-tight">Últimas atividades</h3>
              {activities.length > 5 && (
                <a href="#historico" className="text-xs font-medium text-subtle hover:text-ink">
                  Ver tudo
                </a>
              )}
            </div>
            <div className="mt-3">
              <Timeline items={activities.slice(0, 5)} />
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <DetailTabs
            tabs={[
              {
                id: "geral",
                label: "Visão geral",
                content: (
                  <>
          {/* Galeria */}
          <div className="rounded-2xl border border-hairline bg-card p-3 md:p-4">
            {p.images.length > 0 && (
              /* Celular: carrossel com todas as fotos, de arrastar para o lado */
              <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 [scrollbar-width:none] md:hidden">
                {p.images.map((img, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={img.id}
                    src={img.url}
                    alt={i === 0 ? p.title : ""}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="aspect-[4/3] w-[85%] shrink-0 snap-center rounded-xl object-cover"
                  />
                ))}
              </div>
            )}
            {p.images.length > 0 && (
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-subtle md:hidden">
                {p.images.length} {p.images.length === 1 ? "foto" : "fotos"}
                {p.images.length > 1 ? " · arraste para o lado" : ""}
              </p>
            )}
            {p.images.length ? (
              <div className="hidden grid-cols-3 gap-3 md:grid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.images[0].url}
                  alt={p.title}
                  className="col-span-3 aspect-[16/8] w-full rounded-xl object-cover"
                />
                {p.images.slice(1, 4).map((img) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-subtle">
                Sem fotos — adicione URLs na edição.
              </p>
            )}
          </div>

          {/* Specs + descrição */}
          <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-4">
              {specs.map((s) => (
                <div key={s.label} className="bg-card p-4">
                  <s.icon className="size-4 text-subtle" />
                  <p className="mt-2.5 font-mono text-base font-medium tabular">
                    {s.value}
                  </p>
                  <p className="text-[11px] text-subtle">{s.label}</p>
                </div>
              ))}
            </div>
            {p.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-subtle">
                {p.description}
              </p>
            )}
            {p.features.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {p.features.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs"
                  >
                    <Check className="size-3 text-accent" />
                    {f}
                  </span>
                ))}
              </div>
            )}
            {p.notes?.trim() && (
              <div className="mt-6 border-t border-hairline pt-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">Observações</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-subtle">{p.notes.trim()}</p>
              </div>
            )}
          </div>

          {land && (
            <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">Dados do terreno</h2>
              <LandDetails l={l} area={p.area} price={p.price} mapHref={`/imoveis/${p.code}/mapa`} hasKmz={!!r.kmzUrl} showInternal hideHighlights />
            </div>
          )}

          {rural && (
            <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Dados da propriedade
              </h2>
              <RuralDetails r={r} mapHref={`/imoveis/${p.code}/mapa`} showDocs />
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-card p-4 text-sm leading-relaxed text-subtle md:p-5">
            <p className="font-medium text-ink">{rural ? "Localização" : "Endereço"}</p>
            <p className="mt-1">
              {p.street ? `${p.street}, ` : ""}
              {p.neighborhood}
              <br />
              {p.city} — {p.state}
            </p>
            <p className="mt-2 text-[11px]">Endereço completo só no CRM; no site e na ficha aparecem bairro e cidade.</p>
          </div>
                  </>
                ),
              },
              {
                id: "negocio",
                label: "Negócio",
                count: propertyVisits.length,
                content: (
                  <>
          {/* Parceria e comissão (uso interno) */}
          {(partner || commission.total != null) && (
            <div className="rounded-2xl border border-hairline bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
                <Handshake className="size-4 text-subtle" />
                {partner ? "Imóvel de parceiro" : "Comissão"}
              </h2>
              {partner && (
                <div className="mt-3 rounded-xl bg-soft p-3">
                  <Link href="/crm/parceiros" className="text-sm font-medium hover:underline">
                    {partner.name}
                  </Link>
                  <p className="text-xs text-subtle">
                    {[partner.company, partner.creci && `CRECI ${partner.creci}`, partner.phone && formatPhone(partner.phone)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              )}
              <CommissionBreakdown
                price={p.price}
                commissionPct={p.commissionPct}
                partnerSharePct={partner ? p.partnerSharePct : null}
                taxPct={p.taxPct ?? (partner ? partner.taxPct : null)}
                taxBase={p.taxBase ?? partner?.taxBase ?? "total"}
                className="mt-3"
              />
              <p className="mt-3 text-[11px] text-subtle">Uso interno — não aparece no site nem na ficha.</p>
            </div>
          )}

          {/* Visitas */}
          <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Visitas deste imóvel
              <span className="ml-2 font-mono text-[11px] font-normal text-subtle">
                {propertyVisits.length}
              </span>
            </h2>
            {propertyVisits.length === 0 ? (
              <p className="py-8 text-center text-sm text-subtle">
                Nenhuma visita registrada até agora.
              </p>
            ) : (
              <div className="mt-4 space-y-1">
                {propertyVisits
                  .sort(
                    (a, b) =>
                      new Date(b.visit.scheduledAt).getTime() -
                      new Date(a.visit.scheduledAt).getTime(),
                  )
                  .map(({ visit: v, contact }) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-soft/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {contact?.name ?? "Contato removido"}
                        </p>
                        <p className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                          {formatDateTime(v.scheduledAt)}
                        </p>
                      </div>
                      <Badge
                        className={cn("border", VISIT_STATUS_STYLES[v.status])}
                      >
                        {VISIT_STATUS_LABELS[v.status]}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Desempenho (analytics) */}
          <div className="card-elevrounded-2xl border border-hairline bg-card p-4 md:p-5">
            <h3 className="font-display text-sm font-semibold tracking-tight">
              Desempenho
            </h3>
            <p className="mt-1 text-[11.5px] text-subtle">
              Visualizações na vitrine pública
            </p>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline">
              {[
                { label: "Total", value: views.total },
                { label: "Visitantes únicos", value: views.unique },
                { label: "Últimos 7 dias", value: views.last7 },
                { label: "Últimos 30 dias", value: views.last30 },
              ].map((s) => (
                <div key={s.label} className="bg-card p-3.5">
                  <p className="font-mono text-xl font-medium tabular">
                    {s.value.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-tight text-subtle">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
                Últimos 14 dias
              </p>
              <div className="mt-2 flex h-16 items-end gap-1">
                {views.daily.map((d, i) => {
                  const isToday =
                    d.date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={i}
                      title={`${d.date.toLocaleDateString("pt-BR")} · ${d.count} ${d.count === 1 ? "visualização" : "visualizações"}`}
                      className={
                        isToday
                          ? "w-full rounded-t-sm bg-accent"
                          : "w-full rounded-t-sm bg-hairline-strong"
                      }
                      style={{
                        height: `${Math.max((d.count / Math.max(...views.daily.map((x) => x.count), 1)) * 100, d.count ? 8 : 2)}%`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="">
            <PortalPanel portals={portals} propertyCode={p.code} />
          </div>
                  </>
                ),
              },
              {
                id: "historico",
                label: "Histórico",
                count: documents.length,
                content: (
                  <>
          <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
            <h2 className="font-display text-base font-semibold tracking-tight">Linha do tempo</h2>
            <div className="mt-4">
              <Timeline items={activities} />
            </div>
          </div>
          {/* Documentos internos */}
          <div className="">
            <PropertyDocuments propertyId={p.id} initial={documents} directUpload={!isLocalStorage()} />
          </div>

                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
