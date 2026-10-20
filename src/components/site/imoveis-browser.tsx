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
import { APTIDAO_LABELS, kindOf, RURAL_TYPES } from "@/lib/rural";
import { LAND_TYPES } from "@/lib/land";
import { filtersFromSearch, type SiteSearchParams } from "@/lib/site-search";
import { cn, plural } from "@/lib/utils";
import { DISPLAY_DEFAULTS, gridCols, type ListingDisplay } from "@/lib/site-display";
import { Building2, ChevronDown, LandPlot, Search, SlidersHorizontal, Tractor } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";

const URBAN_TYPES = ["apartamento", "casa", "cobertura", "estudio"];

export type Categoria = "urbanos" | "rurais" | "terrenos";

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
  initialSearch = {},
  display = DISPLAY_DEFAULTS.listing,
}: {
  /** Conteúdo do site › Exibição: colunas, ordem inicial, destaques no topo, quantos por vez */
  display?: ListingDisplay;
  properties: PropertyWithImages[];
  initialCategoria?: Categoria;
  /** Parâmetros da URL (busca vinda da home) */
  initialSearch?: SiteSearchParams;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const urbanos = useMemo(() => properties.filter((p) => kindOf(p.type) === "urbano"), [properties]);
  const rurais = useMemo(() => properties.filter((p) => kindOf(p.type) === "rural"), [properties]);
  const terrenos = useMemo(() => properties.filter((p) => kindOf(p.type) === "terreno"), [properties]);
  // Sem anúncios publicados na categoria, a aba não aparece
  const [categoria, setCategoria] = useState<Categoria>(
    initialCategoria === "rurais" && rurais.length
      ? "rurais"
      : initialCategoria === "terrenos" && terrenos.length
        ? "terrenos"
        : "urbanos",
  );
  const rural = categoria === "rurais";
  const land = categoria === "terrenos";
  const base = rural ? rurais : land ? terrenos : urbanos;
  const TYPES: string[] = rural
    ? [...RURAL_TYPES]
    : land
      ? LAND_TYPES.filter((t) => terrenos.some((p) => p.type === t))
      : URBAN_TYPES;

  const [filters, setFilters] = useState<PropertyFilters>(() => ({
    ...EMPTY_PROPERTY_FILTERS,
    sort: display.sort,
    ...filtersFromSearch(initialSearch),
  }));
  const [limit, setLimit] = useState(display.perPage);
  const [showFilters, setShowFilters] = useState(false);
  // No celular, os atalhos de tipo/finalidade ficam recolhidos
  const [showQuick, setShowQuick] = useState(false);
  const patch = (p: Partial<PropertyFilters>) => setFilters((f) => ({ ...f, ...p }));
  const resetFilters = () => setFilters((f) => ({ ...EMPTY_PROPERTY_FILTERS, q: f.q, sort: f.sort }));
  const closeFilters = useCallback(() => setShowFilters(false), []);

  function switchCategoria(c: Categoria) {
    setCategoria(c);
    setFilters({ ...EMPTY_PROPERTY_FILTERS, sort: display.sort });
    setLimit(display.perPage);
    router.replace(c === "urbanos" ? pathname : `${pathname}?categoria=${c}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    const list = applyPropertyFilters(base, filters, NO_VIEWS, rural);
    // Destaques no topo enquanto a ordem for a padrão (quem escolhe outra ordem vê só ela)
    return display.featuredFirst && filters.sort === display.sort
      ? [...list.filter((p) => p.featured), ...list.filter((p) => !p.featured)]
      : list;
  }, [base, filters, rural, display.featuredFirst, display.sort]);
  // Filtro mudou: volta para a primeira "página"
  const [seenFilters, setSeenFilters] = useState(filters);
  if (seenFilters !== filters) {
    setSeenFilters(filters);
    setLimit(display.perPage);
  }
  const visible = limit > 0 ? filtered.slice(0, limit) : filtered;
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
    <div className="mt-8 md:mt-10">
      {(rurais.length > 0 || terrenos.length > 0) && (
        <div
          className={cn(
            "mb-6 grid rounded-full border border-hairline p-1 sm:inline-flex md:mb-8",
            rurais.length && terrenos.length ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {(
            [
              { id: "urbanos", label: "Imóveis", short: "Imóveis", icon: Building2, count: urbanos.length },
              { id: "terrenos", label: "Terrenos", short: "Terrenos", icon: LandPlot, count: terrenos.length },
              { id: "rurais", label: "Propriedades rurais", short: "Rurais", icon: Tractor, count: rurais.length },
            ] as const
          )
            .filter((c) => c.id === "urbanos" || c.count > 0)
            .map((c) => (
            <button
              key={c.id}
              onClick={() => switchCategoria(c.id)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 sm:px-4",
                categoria === c.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
              )}
            >
              <c.icon className="size-4" />
              <span className="sm:hidden">{c.short}</span>
              <span className="hidden sm:inline">{c.label}</span>
              <span className="font-mono text-[11px] opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Busca (celular: rola com a página; a linha de botões abaixo fica presa no topo) */}
      <div className="relative md:hidden">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={filters.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder={rural ? "Buscar por cidade, região, cultura ou código…" : "Buscar por bairro, rua, nome ou código…"}
          className="pl-10"
        />
      </div>


      {/* Barra de filtros — no celular fica presa no topo ao rolar */}
      <div className="sticky top-[calc(4rem+var(--adminbar,0px)+var(--header-safe,env(safe-area-inset-top)))] z-20 -mx-5 mt-3 flex flex-wrap items-center gap-3 border-b border-hairline bg-canvas/85 px-5 py-2.5 backdrop-blur-xl sm:mx-0 sm:px-0 md:static md:mt-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative hidden min-w-64 flex-1 md:block">
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
          {land && <option value="ppm_asc">Menor preço por m²</option>}
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
        title={rural ? "Filtrar propriedades" : land ? "Filtrar terrenos" : "Filtrar imóveis"}
        activeCount={chips.length}
        resultLabel={
          rural
            ? `Ver ${filtered.length} ${plural(filtered.length, "propriedade", "propriedades")}`
            : land
              ? `Ver ${filtered.length} ${plural(filtered.length, "terreno", "terrenos")}`
              : `Ver ${filtered.length} ${plural(filtered.length, "imóvel", "imóveis")}`
        }
      >
        <PropertyFiltersPanel
          value={filters}
          onChange={patch}
          items={base}
          views={NO_VIEWS}
          rural={rural}
          land={land}
          publicMode
        />
      </FilterSheet>

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-subtle md:mt-8">
        {rural
          ? `${filtered.length} ${plural(filtered.length, "propriedade encontrada", "propriedades encontradas")}`
          : land
            ? `${filtered.length} ${plural(filtered.length, "terreno encontrado", "terrenos encontrados")}`
            : `${filtered.length} ${plural(filtered.length, "imóvel", "imóveis")} encontrados`}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Nada por aqui — ainda"
            description="Tente ampliar os filtros ou fale com um corretor: temos imóveis que ainda não estão no site."
            action={
              <button
                onClick={() => setFilters({ ...EMPTY_PROPERTY_FILTERS, sort: display.sort })}
                className="rounded-full border border-hairline px-4 py-2 text-sm transition-colors hover:bg-soft"
              >
                Limpar filtros
              </button>
            }
          />
        </div>
      ) : (
        <>
        <div className={cn("mt-5 grid gap-x-6 gap-y-9 md:mt-6 md:gap-y-12", gridCols(display.columns))}>
          {visible.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <PropertyCard property={p} />
            </div>
          ))}
        </div>
        {visible.length < filtered.length && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + display.perPage)}
            className="mx-auto mt-10 flex h-12 items-center justify-center gap-2 rounded-full border border-hairline-strong px-8 text-sm font-medium transition-colors hover:bg-soft"
          >
            Ver mais {Math.min(display.perPage, filtered.length - visible.length)}
            <span className="font-mono text-xs text-subtle">
              ({visible.length} de {filtered.length})
            </span>
          </button>
        )}
        </>
      )}
    </div>
  );
}
