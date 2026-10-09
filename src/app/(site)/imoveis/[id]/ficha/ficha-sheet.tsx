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
}: {
  p: PropertyWithImages;
  orgName: string;
  domain: string;
  phone: string;
  brokerName: string;
  brokerRole: string;
  today: string;
}) {
  const imgs = p.images.map((i) => i.url);
  const specs = [
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
  const features = p.features.slice(0, MAX_FEATURES);
  const extraFeatures = p.features.length - features.length;
  const costs = [
    p.condoFee ? `Condomínio ${formatBRL(p.condoFee)}/mês` : null,
    p.iptu ? `IPTU ${formatBRL(p.iptu)}/ano` : null,
  ].filter(Boolean);

  return (
    <article className="ficha-sheet mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[13mm] pb-[10mm] pt-[12mm] text-neutral-900 shadow-sm print:shadow-none">
      {/* Cabeçalho */}
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 pb-[4mm]">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="size-8">
            <rect width="64" height="64" rx="14" fill="#0A0A0A" />
            <path
              d="M20 46V18l24 28V18"
              fill="none"
              stroke="#10B981"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold tracking-tight">{orgName}</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{domain}</p>
          </div>
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          <p>Ref. {p.code}</p>
          <p>{today}</p>
        </div>
      </header>

      {/* Título + preço */}
      <div className="mt-[5mm] flex shrink-0 items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            {TYPE_LABELS[p.type]} · {p.purpose === "venda" ? "Venda" : "Aluguel"} ·{" "}
            {STATUS_LABELS[p.status]}
          </p>
          <h1 className="mt-1.5 line-clamp-2 text-[22px] font-semibold leading-tight tracking-tight">
            {p.title}
          </h1>
          <p className="mt-1 truncate text-xs text-neutral-500">
            {p.street ? `${p.street}, ` : ""}
            {p.neighborhood} — {p.city}/{p.state}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9.5px] uppercase tracking-[0.2em] text-neutral-400">
            {p.purpose === "venda" ? "Valor de venda" : "Aluguel"}
          </p>
          <p className="mt-1 font-mono text-[24px] font-medium leading-none tabular">
            {formatBRL(p.price)}
          </p>
          {costs.length > 0 && (
            <p className="mt-1.5 text-[10.5px] text-neutral-500">{costs.join(" · ")}</p>
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
        className="mt-[5mm] grid shrink-0 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200"
        style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))` }}
      >
        {specs.map((s) => (
          <div key={s.label} className="bg-neutral-50 px-3 py-2.5">
            <s.icon className="size-3.5 text-neutral-400" />
            <p className="mt-1 font-mono text-[15px] font-medium leading-tight tabular">
              {s.value}
            </p>
            <p className="truncate text-[10px] text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Descrição + comodidades: ocupam o espaço restante */}
      <div
        className={`mt-[5mm] grid min-h-0 flex-1 gap-[7mm] ${
          features.length ? "grid-cols-[1.15fr_1fr]" : "grid-cols-1"
        }`}
      >
        <section className="flex min-h-0 flex-col">
          <h2 className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Sobre o imóvel
          </h2>
          <p className="ficha-fade mt-2 min-h-0 flex-1 overflow-hidden whitespace-pre-line text-[11px] leading-[1.55] text-neutral-700">
            {p.description || "—"}
          </p>
        </section>
        {features.length > 0 && (
          <section className="min-h-0 overflow-hidden">
            <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Comodidades
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {features.map((f) => (
                <li key={f} className="flex min-w-0 items-start gap-1.5 text-[10.5px] leading-snug">
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                  <span className="line-clamp-2">{f}</span>
                </li>
              ))}
              {extraFeatures > 0 && (
                <li className="col-span-2 pl-[18px] text-[10px] text-neutral-500">
                  + {extraFeatures} outras
                </li>
              )}
            </ul>
          </section>
        )}
      </div>

      {/* Rodapé */}
      <footer className="mt-[5mm] flex shrink-0 items-center justify-between gap-4 rounded-md bg-neutral-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold">{brokerName}</p>
          <p className="truncate text-[10px] text-neutral-400">{brokerRole}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MessageCircle className="size-4 text-emerald-400" />
          <span className="font-mono text-[13px] tabular">{phone}</span>
        </div>
        <p className="shrink-0 text-right text-[9px] uppercase tracking-[0.16em] text-neutral-400">
          {domain}
        </p>
      </footer>
    </article>
  );
}
