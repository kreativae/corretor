import {
  FORMATO_TERRENO,
  formatM2,
  formatMeters,
  landDimensions,
  landNumbers,
  POSICAO_SOLAR,
  TOPOGRAFIA_TERRENO,
  type LandData,
} from "@/lib/land";
import { formatBRL } from "@/lib/utils";
import { Check, FileCheck2, Map as MapIcon, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function ChipList({ items, title, icon: Icon }: { items: string[]; title: string; icon: typeof Check }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-subtle">
        <Icon className="size-3.5" /> {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs">
            <Check className="size-3 text-accent" />
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ficha técnica do terreno (CRM e site). */
export function LandDetails({
  l,
  area,
  price,
  mapHref,
  hasKmz,
  showInternal,
  hideHighlights,
}: {
  l: LandData;
  /** Área do terreno (m²) */
  area: number;
  price: number;
  /** Página do mapa do KMZ, quando houver arquivo */
  mapHref?: string;
  hasKmz?: boolean;
  /** Quadra, lote e matrícula — apenas no CRM */
  showInternal?: boolean;
  /** A página já mostra área, medidas e preço do m² em destaque */
  hideHighlights?: boolean;
}) {
  const nums = landNumbers(price, area, l);
  const highlights: [string, string][] = (
    [
      ["Área do terreno", area ? formatM2(area) : null],
      ["Medidas", landDimensions(l) || null],
      ["Preço por m²", nums.pricePerM2 ? formatBRL(nums.pricePerM2) : null],
      ["Área construível", nums.buildable ? formatM2(nums.buildable) : null],
    ] as [string, string | null][]
  ).filter(([, v]) => v) as [string, string][];
  const rows: [string, string | null][] = [
    ["Formato", l.formato ? FORMATO_TERRENO[l.formato] : null],
    ["Topografia", l.topografia ? TOPOGRAFIA_TERRENO[l.topografia] : null],
    ["Frente voltada para", l.posicaoSolar ? POSICAO_SOLAR[l.posicaoSolar] : null],
    ["Lateral esquerda", l.ladoEsqM ? formatMeters(l.ladoEsqM) : null],
    ["Lateral direita", l.ladoDirM ? formatMeters(l.ladoDirM) : null],
    ["Situação", l.situacao.length ? l.situacao.join(", ") : null],
    ["Zoneamento", l.zoneamento || null],
    ["Uso permitido", l.usoPermitido.length ? l.usoPermitido.join(", ") : null],
    ["Coeficiente de aproveitamento", l.coeficiente ? `${fmt(l.coeficiente)}×` : null],
    ["Taxa de ocupação", l.taxaOcupacao ? `${fmt(l.taxaOcupacao)}%` : null],
    ["Ocupação máxima", nums.footprint ? formatM2(nums.footprint) : null],
    ["Gabarito", l.gabarito ? `${fmt(l.gabarito)} pavimento${l.gabarito === 1 ? "" : "s"}` : null],
    ["Loteamento / condomínio", l.loteamento || null],
    ["Distância do centro", l.distanciaCentroKm != null ? `${fmt(l.distanciaCentroKm)} km` : null],
  ];
  const internal: [string, string][] = showInternal
    ? ([
        ["Quadra", l.quadra],
        ["Lote", l.lote],
        ["Matrícula", l.matricula],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  return (
    <div className="space-y-6">
      {!hideHighlights && highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-4">
          {highlights.map(([k, v]) => (
            <div key={k} className="bg-card p-4">
              <p className="font-mono text-base font-medium tabular">{v}</p>
              <p className="text-[11px] text-subtle">{k}</p>
            </div>
          ))}
        </div>
      )}

      {l.vantagens.length > 0 && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            <Sparkles className="size-3.5" /> Vantagens
          </p>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {l.vantagens.map((v) => (
              <li key={v} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-hairline/60 pb-2">
              <dt className="text-subtle">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
      </dl>

      <ChipList items={l.infraestrutura} title="Infraestrutura" icon={Zap} />
      <ChipList items={l.documentacao} title="Documentação" icon={FileCheck2} />

      {internal.length > 0 && (
        <div className="rounded-xl bg-soft p-4">
          <p className="mb-2 text-xs font-medium text-subtle">Identificação (interno)</p>
          <dl className="space-y-1.5 text-xs">
            {internal.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-subtle">{k}</dt>
                <dd className="break-all text-right font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {hasKmz && mapHref && (
        <Link
          href={mapHref}
          target="_blank"
          className="flex items-center gap-3 rounded-xl border border-hairline p-4 transition-colors hover:bg-soft"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <MapIcon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Ver perímetro no mapa</span>
            <span className="block text-xs text-subtle">Imagem de satélite e download do KMZ</span>
          </span>
        </Link>
      )}
    </div>
  );
}
