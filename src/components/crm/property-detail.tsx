import { RuralDetails } from "@/components/rural-details";
import {
  APTIDAO_LABELS,
  crmPropertyPath,
  formatAlq,
  formatHa,
  formatPct,
  isRuralType,
  normalizeRural,
  pricePerAlq,
  ruralAreas,
} from "@/lib/rural";
import { AdExporterModal } from "@/components/crm/ad-exporter-modal";
import { PortalPanel } from "@/components/crm/portal-panel";
import { PropertyDocuments } from "@/components/crm/property-documents";
import { Timeline } from "@/components/crm/timeline";
import { Badge, Button } from "@/components/ui";
import { getPropertyViewStats, getWhiteLabel } from "@/lib/queries";
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
import { cn, formatBRL, formatDateTime, timeAgo, formatNumber } from "@/lib/utils";
import {
  ArrowLeft,
  BedDouble,
  Car,
  Check,
  FileDown,
  Globe,
  Map as MapIcon,
  MessageCircle,
  Pencil,
  Ruler,
  ShowerHead,
  Sprout,
  Trees,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/** Detalhe do imóvel no CRM — usado por /crm/imoveis/[id] e /crm/propriedades/[id]. */
export async function PropertyDetail({
  id,
  section,
}: {
  id: string;
  section: "imoveis" | "propriedades";
}) {
  const [p, portals, allVisits, wl] = await Promise.all([
    getPropertyById(id),
    listPortals(),
    listVisits(),
    getWhiteLabel(),
  ]);
  if (!p) notFound();
  // Rurais vivem em /crm/propriedades; urbanos em /crm/imoveis
  if (isRuralType(p.type) !== (section === "propriedades")) redirect(crmPropertyPath(p));

  const [activities, views, documents] = await Promise.all([
    listActivitiesFor("imovel", p.id, 15),
    getPropertyViewStats(p.id),
    listPropertyDocuments(p.id),
  ]);
  const propertyVisits = allVisits.filter((v) => v.property?.id === p.id);

  const rural = isRuralType(p.type);
  const r = normalizeRural(p.rural);
  const areas = ruralAreas(r);
  const specs = rural
    ? [
        { icon: Ruler, label: `Área total · ${formatHa(areas.total)} ha`, value: `${formatAlq(areas.total)} alq` },
        { icon: Sprout, label: "Aptidão", value: r.aptidao ? APTIDAO_LABELS[r.aptidao] : "—" },
        { icon: Wheat, label: "Área plantada", value: `${formatAlq(areas.plantada)} alq` },
        { icon: Trees, label: "Reserva legal", value: formatPct(areas.reservaPct) },
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href={rural ? "/crm/propriedades" : "/crm/imoveis"}
            className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:bg-soft hover:text-ink"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
              {p.code} · {TYPE_LABELS[p.type]} · {PURPOSE_LABELS[p.purpose]}
            </p>
            <h1 className="mt-1.5 max-w-xl font-display text-2xl font-semibold tracking-tight md:text-3xl">
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
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                    : "border-hairline bg-soft text-subtle",
                )}
              >
                {p.published ? "Publicado no site" : "Fora da vitrine"}
              </Badge>
            </div>
          </div>
        </div>
        {/* Ações: no celular em grade de 2 colunas, botões largos */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center [&_button]:w-full sm:[&_button]:w-auto">
          <AdExporterModal property={p} whiteLabel={wl} />
          <Link href={crmPropertyPath(p, "/editar")}>
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" />
              Editar
            </Button>
          </Link>
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
          {rural && r.kmzUrl && (
            <Link href={`/imoveis/${p.code}/mapa`} target="_blank">
              <Button variant="outline" size="sm">
                <MapIcon className="size-3.5" />
                Mapa
              </Button>
            </Link>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Confira este imóvel: ${p.title} (${p.code}) — ${formatBRL(p.price)}`)}`}
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

      {/* Celular: preço e local logo no topo (o cartão completo fica no fim) */}
      <div className="flex items-end justify-between gap-3 rounded-2xl border border-hairline bg-card p-4 lg:hidden">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
            {p.purpose === "aluguel" ? "Aluguel" : "Venda"}
          </p>
          <p className="mt-1 font-mono text-xl font-medium tabular tracking-tight">{formatBRL(p.price)}</p>
          <p className="mt-1 truncate text-xs text-subtle">
            {p.neighborhood}, {p.city} — {p.state}
          </p>
        </div>
        <p className="shrink-0 text-right font-mono text-xs tabular text-subtle">
          {rural
            ? pricePerAlq(p.price, r.totalAlq)
              ? `${formatBRL(pricePerAlq(p.price, r.totalAlq))}/alq`
              : ""
            : p.area
              ? `${formatBRL(Math.round(p.price / p.area))}/m²`
              : ""}
          <span className="block">{views.total.toLocaleString("pt-BR")} visualizações</span>
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* Galeria */}
          <div className="rounded-2xl border border-hairline bg-card p-4">
            {p.images.length ? (
              <div className="grid grid-cols-3 gap-3">
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
          </div>

          {rural && (
            <div className="rounded-2xl border border-hairline bg-card p-4 md:p-6">
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Dados da propriedade
              </h2>
              <RuralDetails r={r} mapHref={`/imoveis/${p.code}/mapa`} showDocs />
            </div>
          )}

          {/* Documentos internos */}
          <PropertyDocuments propertyId={p.id} initial={documents} />

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

        </div>

        {/* Coluna lateral */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
              {p.purpose === "aluguel" ? "Aluguel" : "Venda"}
            </p>
            <p className="mt-2 font-mono text-2xl font-medium tabular tracking-tight">
              {formatBRL(p.price)}
            </p>
            <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
              {(rural
                ? [["Por alqueire", pricePerAlq(p.price, r.totalAlq)]]
                : [
                    ["Condomínio", p.condoFee],
                    ["IPTU /ano", p.iptu],
                    ["Terreno", p.lotArea ? `${formatNumber(p.lotArea)} m²` : null],
                    ["Suítes", p.suites || null],
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
            <div className="mt-4 rounded-xl bg-soft p-3.5 text-xs leading-relaxed text-subtle">
              <p className="font-medium text-ink">{rural ? "Localização" : "Endereço"}</p>
              <p className="mt-1">
                {p.street ? `${p.street}, ` : ""}
                {p.neighborhood}
                <br />
                {p.city} — {p.state}
              </p>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-subtle">
              Criado {timeAgo(p.createdAt)} · Atualizado {timeAgo(p.updatedAt)}
            </p>
          </div>

          {/* Desempenho (analytics) */}
          <div className="card-elev rounded-2xl border border-hairline bg-card p-5">
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

          {/* Linha do tempo */}
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <h3 className="mb-5 font-display text-sm font-semibold tracking-tight">
              Linha do tempo
            </h3>
            <Timeline items={activities} />
          </div>

          <PortalPanel portals={portals} propertyCode={p.code} />
        </div>
      </div>
    </div>
  );
}
