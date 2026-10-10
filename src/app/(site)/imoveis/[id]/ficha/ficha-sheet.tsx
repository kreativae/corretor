import { BRAND_NAVY, Monogram } from "@/components/monogram";
import {
  ACESSO_LABELS,
  APTIDAO_LABELS,
  ENERGIA_LABELS,
  formatAlq,
  formatHa,
  formatPct,
  isRuralType,
  normalizeRural,
  pricePerAlq,
  ruralAreas,
  SOLO_LABELS,
  TOPOGRAFIA_LABELS,
} from "@/lib/rural";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { formatBRL, formatNumber } from "@/lib/utils";
import {
  BedDouble,
  Bath,
  Car,
  Check,
  MessageCircle,
  Ruler,
  Trees,
  Compass,
  Sprout,
  Wheat,
} from "lucide-react";

const MAX_FEATURES = 24;

/**
 * Ficha em uma única folha A4 (210 × 297 mm), igual na tela e na impressão.
 * Altura fixa: textos longos são cortados com reticências em vez de quebrar página.
 */
export function FichaSheet({
  p,
  orgName,
  domain,
  phone,
  brokerName,
  brokerRole,
  today,
  logoUrl,
  iconUrl,
  showIcon = true,
  showName = true,
  showDomain = true,
  qrSvg,
  qrKind = "mapa",
  qrUrl,
  whatsappUrl,
}: {
  p: PropertyWithImages;
  orgName: string;
  domain: string;
  phone: string;
  brokerName: string;
  brokerRole: string;
  today: string;
  logoUrl?: string;
  iconUrl?: string;
  showIcon?: boolean;
  showName?: boolean;
  showDomain?: boolean;
  /** QR code (SVG) para baixar o KMZ — propriedades rurais */
  qrSvg?: string;
  /** Mesmo endereço do QR: vira link clicável no PDF */
  qrUrl?: string;
  /** WhatsApp do corretor: telefone clicável no PDF */
  whatsappUrl?: string;
  /** Destino do QR: mapa do KMZ (rurais) ou formulário do consultor */
  qrKind?: "mapa" | "contato";
}) {
  const imgs = p.images.map((i) => i.url);
  const rural = isRuralType(p.type);
  const r = normalizeRural(p.rural);
  const areas = ruralAreas(r);
  const urbanSpecs = [
    { icon: Ruler, label: "Área construída", value: `${formatNumber(p.area)} m²` },
    p.lotArea ? { icon: Trees, label: "Terreno", value: `${formatNumber(p.lotArea)} m²` } : null,
    {
      icon: BedDouble,
      label: p.suites ? `Quartos · ${p.suites} suíte${p.suites > 1 ? "s" : ""}` : "Quartos",
      value: String(p.bedrooms),
    },
    { icon: Bath, label: "Banheiros", value: String(p.bathrooms) },
    { icon: Car, label: "Vagas", value: String(p.garage) },
  ].filter((s) => s !== null);
  const specs = rural
    ? [
        { icon: Ruler, label: `Área total · ${formatHa(areas.total)} ha`, value: `${formatAlq(areas.total)} alq` },
        { icon: Wheat, label: `Plantada · ${formatPct(areas.plantadaPct)}`, value: `${formatAlq(areas.plantada)} alq` },
        { icon: Sprout, label: `Pastagem · ${formatPct(areas.pastagemPct)}`, value: `${formatAlq(areas.pastagem)} alq` },
        { icon: Trees, label: `Reserva legal · ${formatPct(areas.reservaPct)}`, value: `${formatAlq(areas.reserva)} alq` },
        { icon: Compass, label: "Aptidão", value: r.aptidao ? APTIDAO_LABELS[r.aptidao] : "—" },
      ]
    : urbanSpecs;
  const ruralRows: [string, string][] = rural
    ? ([
        ["Área aberta", `${formatAlq(areas.aberta)} alq`],
        ["APP", areas.app ? `${formatAlq(areas.app)} alq` : ""],
        ["Culturas", r.culturas],
        ["Lotação", r.cabecas ? `${formatAlq(r.cabecas)} cabeças` : ""],
        ["Topografia", r.topografia ? TOPOGRAFIA_LABELS[r.topografia] : ""],
        ["Solo", r.solo ? SOLO_LABELS[r.solo] : ""],
        ["Energia", r.energia ? ENERGIA_LABELS[r.energia] : ""],
        ["Acesso", r.acesso ? ACESSO_LABELS[r.acesso] : ""],
        ["Até a cidade", r.distanciaCidadeKm != null ? `${formatAlq(r.distanciaCidadeKm)} km` : ""],
        ["Água", r.agua.join(", ")],
        ["Benfeitorias", r.benfeitorias.join(", ")],
      ].filter(([, v]) => v) as [string, string][])
    : [];
  const perAlq = rural ? pricePerAlq(p.price, r.totalAlq) : null;
  const features = p.features.slice(0, MAX_FEATURES);
  const extraFeatures = p.features.length - features.length;
  const costs = (
    rural
      ? [perAlq ? `${formatBRL(perAlq)} por alqueire` : null]
      : [
          p.condoFee ? `Condomínio ${formatBRL(p.condoFee)}/mês` : null,
          p.iptu ? `IPTU ${formatBRL(p.iptu)}/ano` : null,
        ]
  ).filter(Boolean);

  return (
    <article className="ficha-sheet mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[13mm] pb-[10mm] pt-[12mm] text-[#2B2B5D] shadow-sm print:shadow-none">
      {/* Cabeçalho */}
      <header className="flex shrink-0 items-center justify-between border-b-2 border-[#2B2B5D] pb-[4mm]">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoUrl} alt={orgName} className="h-9 w-auto max-w-[60mm] object-contain" />
        ) : (
          <div className="flex items-center gap-3">
            {!showIcon ? null : iconUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={iconUrl} alt="" className="size-8 rounded-[22%] object-cover" />
            ) : (
              <Monogram className="size-9" color={BRAND_NAVY} />
            )}
            <div>
              {showName && (
                /* Nome no estilo do logotipo: primeiro nome fino, resto pesado */
                <p className="font-brand text-[15px] uppercase leading-none">
                  <span className="font-extralight">{orgName.split(" ")[0]}</span>{" "}
                  <span className="font-extrabold">{orgName.split(" ").slice(1).join(" ")}</span>
                </p>
              )}
              {showDomain && (
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[#6A6A86]">{domain}</p>
              )}
            </div>
          </div>
        )}
        <div className="text-right font-mono text-[10px] uppercase tracking-wider text-[#6A6A86]">
          <p>Ref. {p.code}</p>
          <p>{today}</p>
        </div>
      </header>

      {/* Título + preço */}
      <div className="mt-[5mm] flex shrink-0 items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-[#D9601A]">
            {TYPE_LABELS[p.type]} · {p.purpose === "venda" ? "Venda" : "Aluguel"} ·{" "}
            {STATUS_LABELS[p.status]}
          </p>
          <h1 className="mt-1.5 line-clamp-2 font-display text-[22px] font-bold leading-tight tracking-tight">
            {p.title}
          </h1>
          <p className="mt-1 truncate text-xs text-[#6A6A86]">
            {p.street ? `${p.street}, ` : ""}
            {p.neighborhood} — {p.city}/{p.state}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9.5px] uppercase tracking-[0.2em] text-[#9A9AB5]">
            {p.purpose === "venda" ? "Valor de venda" : "Aluguel"}
          </p>
          <p className="mt-1 font-mono text-[24px] font-medium leading-none tabular">
            {formatBRL(p.price)}
          </p>
          {costs.length > 0 && (
            <p className="mt-1.5 text-[10.5px] text-[#6A6A86]">{costs.join(" · ")}</p>
          )}
        </div>
      </div>

      {/* Fotos: principal + duas laterais */}
      {imgs.length > 0 && (
        <div
          className={`mt-[5mm] grid h-[92mm] shrink-0 gap-[2mm] ${
            imgs.length > 1 ? "grid-cols-3 grid-rows-2" : "grid-cols-1"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgs[0]}
            alt={p.title}
            className={`size-full rounded-md object-cover ${
              imgs.length > 1 ? "col-span-2 row-span-2" : ""
            }`}
          />
          {imgs.slice(1, 3).map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={src}
              alt=""
              className={`size-full rounded-md object-cover ${
                imgs.length === 2 ? "row-span-2" : ""
              }`}
            />
          ))}
        </div>
      )}

      {/* Características */}
      <div
        className="mt-[5mm] grid shrink-0 gap-px overflow-hidden rounded-md border border-[#DCDCE8] bg-[#DCDCE8]"
        style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))` }}
      >
        {specs.map((s) => (
          <div key={s.label} className="bg-[#F3F3F8] px-3 py-2.5">
            <s.icon className="size-3.5 text-[#9A9AB5]" />
            <p className="mt-1 font-mono text-[15px] font-medium leading-tight tabular">
              {s.value}
            </p>
            <p className="truncate text-[10px] text-[#6A6A86]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Descrição + comodidades: ocupam o espaço restante */}
      <div
        className={`mt-[5mm] grid min-h-0 flex-1 gap-[7mm] ${
          features.length || rural ? "grid-cols-[1.15fr_1fr]" : "grid-cols-1"
        }`}
      >
        <section className="flex min-h-0 flex-col">
          <h2 className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#9A9AB5]">
            {rural ? "Sobre a propriedade" : "Sobre o imóvel"}
          </h2>
          <p className="ficha-fade mt-2 min-h-0 flex-1 overflow-hidden whitespace-pre-line text-[11px] leading-[1.55] text-[#45456E]">
            {p.description || "—"}
          </p>
        </section>
        {rural && (
          <section className="flex min-h-0 flex-col overflow-hidden">
            <h2 className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#9A9AB5]">
              A propriedade
            </h2>
            <dl className="mt-2 min-h-0 flex-1 space-y-1 overflow-hidden text-[10.5px] leading-snug">
              {ruralRows.map(([k, v]) => (
                <div key={k} className="flex gap-2 border-b border-[#EAEAF2] pb-1">
                  <dt className="w-[24mm] shrink-0 text-[#6A6A86]">{k}</dt>
                  <dd className="line-clamp-2 min-w-0 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {!rural && features.length > 0 && (
          <section className="min-h-0 overflow-hidden">
            <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#9A9AB5]">
              Comodidades
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {features.map((f) => (
                <li key={f} className="flex min-w-0 items-start gap-1.5 text-[10.5px] leading-snug">
                  <Check className="mt-0.5 size-3 shrink-0 text-[#F47525]" />
                  <span className="line-clamp-2">{f}</span>
                </li>
              ))}
              {extraFeatures > 0 && (
                <li className="col-span-2 pl-[18px] text-[10px] text-[#6A6A86]">
                  + {extraFeatures} outras
                </li>
              )}
            </ul>
          </section>
        )}
      </div>

      {/* Rodapé */}
      <footer
        className={`mt-[5mm] flex shrink-0 items-center justify-between gap-4 rounded-md bg-[#2B2B5D] px-4 text-white ${
          qrSvg ? "py-2.5" : "py-3"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold">{brokerName}</p>
          <p className="truncate text-[10px] text-[#9A9AB5]">{brokerRole}</p>
        </div>
        {phone && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            data-pdf-link={whatsappUrl}
            className="flex shrink-0 items-center gap-2"
          >
            <MessageCircle className="size-4 text-emerald-400" />
            <span className="font-mono text-[13px] tabular">{phone}</span>
          </a>
        )}
        {showDomain && !qrSvg && (
          <p className="shrink-0 text-right text-[9px] uppercase tracking-[0.16em] text-[#9A9AB5]">
            {domain}
          </p>
        )}
        {qrSvg && (
          <a
            href={qrUrl}
            target="_blank"
            rel="noreferrer"
            data-pdf-link={qrUrl}
            className="flex shrink-0 items-center gap-3"
          >
            <div className="text-right">
              <p className="text-[11px] font-semibold leading-tight">
                {qrKind === "mapa" ? "Veja a propriedade no mapa" : "Fale com um consultor"}
              </p>
              <p className="mt-0.5 text-[9px] leading-snug text-[#9A9AB5]">
                {qrKind === "mapa"
                  ? "Perímetro em satélite, rota e KMZ"
                  : "Aponte a câmera e deixe seu contato"}
                {showDomain && (
                  <>
                    <br />
                    {domain}
                  </>
                )}
              </p>
            </div>
            <div
              className="size-[24mm] shrink-0 rounded-[2mm] bg-white p-[1.6mm] [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </a>
        )}
      </footer>
    </article>
  );
}
