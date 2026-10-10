import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import { APTIDAO_LABELS, formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/** "120 m² · 3 quartos" ou "310 alq · Dupla aptidão" */
function specsLine(p: PropertyWithImages) {
  if (isRuralType(p.type)) {
    const r = normalizeRural(p.rural);
    return `${formatAlq(r.totalAlq ?? 0)} alq${r.aptidao ? ` · ${APTIDAO_LABELS[r.aptidao]}` : ""}`;
  }
  return `${formatNumber(p.area)} m² · ${p.bedrooms} ${p.bedrooms === 1 ? "quarto" : "quartos"}`;
}

export function PropertyCard({
  property: p,
  featured,
}: {
  property: PropertyWithImages;
  featured?: boolean;
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
            src={p.cover}
            alt={p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-display text-subtle">
            Sem foto
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
            {p.purpose === "venda" ? "Venda" : "Aluguel"}
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

      {/* Celular: título inteiro e preço em destaque embaixo */}
      <div className="pt-3 sm:hidden">
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

      <div className="hidden items-start justify-between gap-4 pt-4 sm:flex">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">
            {p.code} · {TYPE_LABELS[p.type]}
          </p>
          <h3 className="mt-1.5 truncate font-display text-lg font-semibold tracking-tight">
            {p.title}
          </h3>
          <p className="mt-0.5 text-sm text-subtle">
            {p.neighborhood}, {p.city}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-medium tabular">
            {formatBRL(p.price)}
            {p.purpose === "aluguel" && (
              <span className="text-subtle"> /mês</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-subtle">{specsLine(p)}</p>
        </div>
      </div>
    </Link>
  );
}
