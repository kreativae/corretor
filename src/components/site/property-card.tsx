import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { cn, formatBRL, formatNumber, siteImage } from "@/lib/utils";
import { APTIDAO_LABELS, formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import { isLandType, landDimensions, normalizeLand } from "@/lib/land";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/** "120 m² · 3 quartos", "310 alq · Dupla aptidão" ou "450 m² · 15 × 30 m" */
function specsLine(p: PropertyWithImages) {
  if (isLandType(p.type)) {
    const dims = landDimensions(normalizeLand(p.land));
    const ppm = p.area ? ` · ${formatBRL(Math.round(p.price / p.area))}/m²` : "";
    return `${formatNumber(p.area)} m²${dims ? ` · ${dims}` : ppm}`;
  }
  if (isRuralType(p.type)) {
    const r = normalizeRural(p.rural);
    return `${formatAlq(r.totalAlq ?? 0)} alq${r.aptidao ? ` · ${APTIDAO_LABELS[r.aptidao]}` : ""}`;
  }
  return `${formatNumber(p.area)} m² · ${p.bedrooms} ${p.bedrooms === 1 ? "quarto" : "quartos"}`;
}

export function PropertyCard({
  property: p,
  featured,
  compact,
  dense,
}: {
  /** Muitas colunas no computador: preço e medidas embaixo do título */
  dense?: boolean;
  property: PropertyWithImages;
  featured?: boolean;
  /** Celular em duas colunas: textos menores e medidas embaixo do preço */
  compact?: boolean;
}) {
  return (
    <Link
      href={`/imoveis/${p.code}`}
      className="group block"
      prefetch={false}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-soft",
          featured ? "aspect-[16/10]" : "aspect-[4/3]",
        )}
      >
        {p.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={siteImage(p.cover, p.wm)}
            alt={p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-display text-subtle">
            Sem foto
          </div>
        )}

        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4",
            // Duas colunas no celular: etiquetas menores para caber na foto
            compact && "max-sm:p-2 max-sm:[&_span]:px-2 max-sm:[&_span]:py-1 max-sm:[&_span]:text-[10px]",
          )}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {p.badgeView && (
              <span
                className="truncate rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm"
                style={{ background: p.badgeView.bg, color: p.badgeView.fg }}
              >
                {p.badgeView.label}
              </span>
            )}
            <span className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
              {p.purpose === "venda" ? "Venda" : "Aluguel"}
            </span>
          </span>
          {p.status !== "disponivel" && (
            <span className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
              {STATUS_LABELS[p.status]}
            </span>
          )}
        </div>

        <div className="absolute bottom-4 right-4 flex size-11 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 transition-all duration-500 ease-expo group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="size-4.5" />
        </div>
      </div>

      {/* Celular em duas colunas */}
      {compact && (
        <div className="pt-2 sm:hidden">
          <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle">
            {p.code} · {p.neighborhood}
          </p>
          <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-semibold leading-snug tracking-tight">{p.title}</h3>
          <p className="mt-1 font-mono text-[13px] font-medium tabular">
            {formatBRL(p.price)}
            {p.purpose === "aluguel" && <span className="text-[10px] text-subtle"> /mês</span>}
          </p>
          <p className="truncate text-[11px] text-subtle">{specsLine(p)}</p>
        </div>
      )}

      {/* Celular: título inteiro e preço em destaque embaixo */}
      <div className={cn("pt-3 sm:hidden", compact && "hidden")}>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
          {p.code} · {TYPE_LABELS[p.type]} · {p.neighborhood}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight">
          {p.title}
        </h3>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="font-mono text-base font-medium tabular">
            {formatBRL(p.price)}
            {p.purpose === "aluguel" && <span className="text-xs text-subtle"> /mês</span>}
          </p>
          <p className="truncate text-xs text-subtle">{specsLine(p)}</p>
        </div>
      </div>

      {dense ? (
        /* 5 ou 6 colunas: tudo empilhado, para caber no card estreito */
        <div className="hidden flex-col gap-1.5 pt-3 sm:flex">
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              {p.code} · {TYPE_LABELS[p.type]}
            </p>
            <h3 className="mt-1 truncate font-display text-base font-semibold tracking-tight">{p.title}</h3>
            <p className="truncate text-xs text-subtle">
              {p.neighborhood}, {p.city}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium tabular">
              {formatBRL(p.price)}
              {p.purpose === "aluguel" && <span className="text-subtle"> /mês</span>}
            </p>
            <p className="mt-0.5 truncate text-xs text-subtle">{specsLine(p)}</p>
          </div>
        </div>
      ) : (
        /* Código e tipo | preço e medidas (metade cada); título e local na largura toda */
        <div className="hidden pt-4 sm:block">
          <div className="grid grid-cols-2 items-start gap-3">
            <p className="min-w-0 truncate pt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
              {p.code} · {TYPE_LABELS[p.type]}
            </p>
            <div className="min-w-0 text-right">
              <p className="truncate font-mono text-sm font-medium tabular">
                {formatBRL(p.price)}
                {p.purpose === "aluguel" && <span className="text-subtle"> /mês</span>}
              </p>
              <p className="mt-0.5 truncate text-xs text-subtle">{specsLine(p)}</p>
            </div>
          </div>
          <h3 className="mt-1.5 truncate font-display text-lg font-semibold tracking-tight">{p.title}</h3>
          <p className="mt-0.5 truncate text-sm text-subtle">
            {p.neighborhood}, {p.city}
          </p>
        </div>
      )}
    </Link>
  );
}
