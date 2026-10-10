"use client";

import { ActiveChips, FilterButton, FilterSheet } from "@/components/crm/filter-sheet";
import {
  activePropertyChips,
  applyPropertyFilters,
  EMPTY_PROPERTY_FILTERS,
  PropertyFiltersPanel,
  type PropertyFilters,
} from "@/components/crm/property-filters";
import { PropertyCard } from "@/components/site/property-card";
import { EmptyState, Input, Select } from "@/components/ui";
import { TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { APTIDAO_LABELS, isRuralType, RURAL_TYPES } from "@/lib/rural";
import { cn, plural } from "@/lib/utils";
import { Building2, ChevronDown, Search, SlidersHorizontal, Tractor } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";

const URBAN_TYPES = ["apartamento", "casa", "cobertura", "estudio", "terreno"];

export type Categoria = "urbanos" | "rurais";

const NO_VIEWS = {};

function QuickChip({
  on,
  accent,
  onClick,
  children,
}: {
  on: boolean;
  accent?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300",
        on
          ? accent
            ? "border-transparent bg-accent text-on-accent"
            : "border-transparent bg-ink text-canvas"
          : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function ImoveisBrowser({
  properties,
  initialCategoria = "urbanos",
}: {
  properties: PropertyWithImages[];
  initialCategoria?: Categoria;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const urbanos = useMemo(() => properties.filter((p) => !isRuralType(p.type)), [properties]);
  const rurais = useMemo(() => properties.filter((p) => isRuralType(p.type)), [properties]);
  // Sem rurais publicadas, a aba não aparece
  const [categoria, setCategoria] = useState<Categoria>(
    initialCategoria === "rurais" && rurais.length ? "rurais" : "urbanos",
  );
  const rural = categoria === "rurais";
  const base = rural ? rurais : urbanos;
  const TYPES: string[] = rural ? [...RURAL_TYPES] : URBAN_TYPES;

  const [filters, setFilters] = useState<PropertyFilters>(EMPTY_PROPERTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  // No celular, os atalhos de tipo/finalidade ficam recolhidos
  const [showQuick, setShowQuick] = useState(false);
  const patch = (p: Partial<PropertyFilters>) => setFilters((f) => ({ ...f, ...p }));
  const resetFilters = () => setFilters((f) => ({ ...EMPTY_PROPERTY_FILTERS, q: f.q, sort: f.sort }));
  const closeFilters = useCallback(() => setShowFilters(false), []);

  function switchCategoria(c: Categoria) {
    setCategoria(c);
    setFilters(EMPTY_PROPERTY_FILTERS);
    router.replace(c === "rurais" ? `${pathname}?categoria=rurais` : pathname, { scroll: false });
  }

  const filtered = useMemo(
    () => applyPropertyFilters(base, filters, NO_VIEWS, rural),
    [base, filters, rural],
  );
  const chips = activePropertyChips(filters, rural);
  const quickCount =
    filters.types.length + (rural ? filters.aptidoes.length : filters.purpose !== "all" ? 1 : 0);
  const toggleType = (t: string) =>
    patch({ types: filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t] });
  const toggleAptidao = (a: string) =>
    patch({
      aptidoes: filters.aptidoes.includes(a)
        ? filters.aptidoes.filter((x) => x !== a)
        : [...filters.aptidoes, a],
    });

  return (
    <div className="mt-10">
      {rurais.length > 0 && (
        <div className="mb-8 inline-flex rounded-full border border-hairline p-1">
          {(
            [
              { id: "urbanos", label: "Imóveis", icon: Building2, count: urbanos.length },
              { id: "rurais", label: "Propriedades rurais", icon: Tractor, count: rurais.length },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => switchCategoria(c.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                categoria === c.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
              )}
            >
              <c.icon className="size-4" />
              {c.label}
              <span className="font-mono text-[11px] opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative basis-full md:min-w-64 md:flex-1 md:basis-auto">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder={rural ? "Buscar por cidade, região, cultura ou código…" : "Buscar por bairro, rua, nome ou código…"}
            className="pl-10"
          />
        </div>
        <FilterButton count={chips.length} onClick={() => setShowFilters(true)} />
        <Select
          value={filters.sort}
          onChange={(e) => patch({ sort: e.target.value as PropertyFilters["sort"] })}
          className="w-auto min-w-0 flex-1 md:flex-none"
          aria-label="Ordenar"
        >
          <option value="recent">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="area_desc">Maior área</option>
          {rural && <option value="ppa_asc">Menor preço por alqueire</option>}
        </Select>
        <button
          type="button"
          onClick={() => setShowQuick((v) => !v)}
          aria-expanded={showQuick}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3.5 text-sm text-subtle transition-colors hover:text-ink md:hidden"
        >
          Tipo
          {quickCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] text-on-accent">
              {quickCount}
            </span>
          )}
          <ChevronDown className={cn("size-3.5 transition-transform", showQuick && "rotate-180")} />
        </button>
      </div>

      <div
        className={cn(
          "mt-5 flex-wrap items-center gap-2 md:flex",
          showQuick ? "flex" : "hidden",
        )}
      >
        <SlidersHorizontal className="size-4 text-subtle" />
        <QuickChip on={!filters.types.length} onClick={() => patch({ types: [] })}>
          Todos
        </QuickChip>
        {TYPES.map((t) => (
          <QuickChip key={t} on={filters.types.includes(t)} onClick={() => toggleType(t)}>
            {TYPE_LABELS[t]}
          </QuickChip>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-hairline sm:block" />
        {rural
          ? Object.entries(APTIDAO_LABELS).map(([id, label]) => (
              <QuickChip key={id} accent on={filters.aptidoes.includes(id)} onClick={() => toggleAptidao(id)}>
                {label}
              </QuickChip>
            ))
          : (
              [
                { id: "all", label: "Comprar e alugar" },
                { id: "venda", label: "Comprar" },
                { id: "aluguel", label: "Alugar" },
              ] as const
            ).map((p) => (
              <QuickChip key={p.id} accent on={filters.purpose === p.id} onClick={() => patch({ purpose: p.id })}>
                {p.label}
              </QuickChip>
            ))}
      </div>
      <ActiveChips chips={chips} onClear={patch} onClearAll={resetFilters} />

      <FilterSheet
        open={showFilters}
        onClose={closeFilters}
        onReset={resetFilters}
        title={rural ? "Filtrar propriedades" : "Filtrar imóveis"}
        activeCount={chips.length}
        resultLabel={
          rural
            ? `Ver ${filtered.length} ${plural(filtered.length, "propriedade", "propriedades")}`
            : `Ver ${filtered.length} ${plural(filtered.length, "imóvel", "imóveis")}`
        }
      >
        <PropertyFiltersPanel
          value={filters}
          onChange={patch}
          items={base}
          views={NO_VIEWS}
          rural={rural}
          publicMode
        />
      </FilterSheet>

      <p className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-subtle">
        {rural
          ? `${filtered.length} ${plural(filtered.length, "propriedade encontrada", "propriedades encontradas")}`
          : `${filtered.length} ${plural(filtered.length, "imóvel", "imóveis")} encontrados`}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Nada por aqui — ainda"
            description="Tente ampliar os filtros ou fale com um curador: temos imóveis off-market que não entram na vitrine."
            action={
              <button
                onClick={() => setFilters(EMPTY_PROPERTY_FILTERS)}
                className="rounded-full border border-hairline px-4 py-2 text-sm transition-colors hover:bg-soft"
              >
                Limpar filtros
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <PropertyCard property={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
