/**
 * Conteúdo do site › Exibição: quantos imóveis aparecem em cada seção da home, em quantas
 * colunas, em que ordem, de onde vêm (destaques ou todos) e o limite por bairro; e o
 * padrão da página de listagem. Regras puras, usadas no servidor e no navegador.
 */

export type DisplaySort = "featured" | "recent" | "price_desc" | "price_asc" | "area_desc" | "views" | "random";
export type DisplaySource = "featured_first" | "featured" | "all";
export type HomeSectionId = "imoveis" | "terrenos" | "rurais" | "bairros";
export type Columns = 2 | 3 | 4;

export type HomeBlock = {
  show: boolean;
  eyebrow: string;
  title: string;
  /** Quantos imóveis aparecem */
  count: number;
  columns: Columns;
  sort: DisplaySort;
  source: DisplaySource;
  /** Máximo de imóveis do mesmo bairro (0 = sem limite) — mistura as regiões */
  perHood: number;
  purpose: "all" | "venda" | "aluguel";
  /** Só desta cidade (vazio = todas) */
  city: string;
};

export type HoodsBlock = {
  show: boolean;
  eyebrow: string;
  title: string;
  count: number;
  columns: Columns;
  /** Bairro só aparece com pelo menos N imóveis */
  minPerHood: number;
  /** Quais imóveis contam: só os urbanos ou todos (terrenos e rurais também) */
  include: "urbano" | "todos";
};

export type ListingDisplay = {
  columns: Columns;
  /** Ordem inicial da página /imoveis (o visitante pode trocar) */
  sort: "recent" | "price_asc" | "price_desc" | "area_desc";
  /** Destaques no topo da listagem */
  featuredFirst: boolean;
  /** Imóveis por vez, com "Ver mais" (0 = todos de uma vez) */
  perPage: number;
};

export type SiteDisplay = {
  /** Ordem das seções da home, depois dos cards de categoria */
  order: HomeSectionId[];
  imoveis: HomeBlock;
  terrenos: HomeBlock;
  rurais: HomeBlock;
  bairros: HoodsBlock;
  listing: ListingDisplay;
};

const block = (b: Partial<HomeBlock>): HomeBlock => ({
  show: true,
  eyebrow: "",
  title: "",
  count: 3,
  columns: 3,
  sort: "featured",
  source: "featured_first",
  perHood: 0,
  purpose: "all",
  city: "",
  ...b,
});

export const DISPLAY_DEFAULTS: SiteDisplay = {
  order: ["imoveis", "bairros", "terrenos", "rurais"],
  // Título e linha de apoio dos imóveis vêm da aba Destaques (collection)
  imoveis: block({ count: 6 }),
  terrenos: block({ eyebrow: "Para construir", title: "" }),
  rurais: block({ eyebrow: "No campo", title: "Propriedades rurais" }),
  bairros: { show: true, eyebrow: "Por região", title: "Buscar por bairro", count: 8, columns: 4, minPerHood: 1, include: "urbano" },
  listing: { columns: 3, sort: "recent", featuredFirst: true, perPage: 0 },
};

export const SORT_LABELS: Record<DisplaySort, string> = {
  featured: "Destaques primeiro, depois os mais recentes",
  recent: "Mais recentes",
  price_desc: "Maior preço",
  price_asc: "Menor preço",
  area_desc: "Maior área",
  views: "Mais vistos no site",
  random: "Aleatória (muda a cada visita)",
};

export const SOURCE_LABELS: Record<DisplaySource, string> = {
  featured_first: "Destaques e, se faltar, os demais",
  featured: "Só os marcados como destaque",
  all: "Todos os publicados",
};

const SECTIONS: HomeSectionId[] = ["imoveis", "bairros", "terrenos", "rurais"];
const int = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const cols = (v: unknown, def: Columns): Columns => ([2, 3, 4].includes(Number(v)) ? (Number(v) as Columns) : def);
const pick = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const text = (v: unknown, def: string) => (typeof v === "string" ? v.slice(0, 120) : def);

function cleanBlock(v: unknown, def: HomeBlock): HomeBlock {
  const b = (v ?? {}) as Partial<HomeBlock>;
  return {
    show: typeof b.show === "boolean" ? b.show : def.show,
    eyebrow: text(b.eyebrow, def.eyebrow),
    title: text(b.title, def.title),
    count: int(b.count, 1, 24, def.count),
    columns: cols(b.columns, def.columns),
    sort: pick(b.sort, Object.keys(SORT_LABELS) as DisplaySort[], def.sort),
    source: pick(b.source, Object.keys(SOURCE_LABELS) as DisplaySource[], def.source),
    perHood: int(b.perHood, 0, 24, def.perHood),
    purpose: pick(b.purpose, ["all", "venda", "aluguel"] as const, def.purpose),
    city: text(b.city, def.city).trim(),
  };
}

/** Junta o salvo com os padrões, só com valores válidos */
export function normalizeDisplay(v: unknown): SiteDisplay {
  const d = (v ?? {}) as Partial<SiteDisplay>;
  const order = Array.isArray(d.order) ? d.order.filter((x): x is HomeSectionId => SECTIONS.includes(x)) : [];
  const b = (d.bairros ?? {}) as Partial<HoodsBlock>;
  const l = (d.listing ?? {}) as Partial<ListingDisplay>;
  const D = DISPLAY_DEFAULTS;
  return {
    // Seção que faltar na ordem salva entra no fim
    order: [...new Set([...order, ...SECTIONS])],
    imoveis: cleanBlock(d.imoveis, D.imoveis),
    terrenos: cleanBlock(d.terrenos, D.terrenos),
    rurais: cleanBlock(d.rurais, D.rurais),
    bairros: {
      show: typeof b.show === "boolean" ? b.show : D.bairros.show,
      eyebrow: text(b.eyebrow, D.bairros.eyebrow),
      title: text(b.title, D.bairros.title),
      count: int(b.count, 1, 24, D.bairros.count),
      columns: cols(b.columns, D.bairros.columns),
      minPerHood: int(b.minPerHood, 1, 50, D.bairros.minPerHood),
      include: pick(b.include, ["urbano", "todos"] as const, D.bairros.include),
    },
    listing: {
      columns: cols(l.columns, D.listing.columns),
      sort: pick(l.sort, ["recent", "price_asc", "price_desc", "area_desc"] as const, D.listing.sort),
      featuredFirst: typeof l.featuredFirst === "boolean" ? l.featuredFirst : D.listing.featuredFirst,
      perPage: int(l.perPage, 0, 120, D.listing.perPage),
    },
  };
}

type Item = {
  id: string;
  featured?: boolean;
  price: number;
  area: number;
  purpose: string;
  neighborhood: string;
  city: string;
  createdAt: Date | string;
};

const time = (d: Date | string) => new Date(d).getTime();

/** Ordena uma lista (cópia) pelo critério escolhido */
export function sortItems<T extends Item>(list: T[], sort: DisplaySort, views: Record<string, number> = {}, seed = Date.now()): T[] {
  const out = [...list];
  const recent = (a: T, b: T) => time(b.createdAt) - time(a.createdAt);
  switch (sort) {
    case "featured":
      return out.sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || recent(a, b));
    case "recent":
      return out.sort(recent);
    case "price_desc":
      return out.sort((a, b) => b.price - a.price);
    case "price_asc":
      return out.sort((a, b) => a.price - b.price);
    case "area_desc":
      return out.sort((a, b) => b.area - a.area);
    case "views":
      return out.sort((a, b) => (views[b.id] ?? 0) - (views[a.id] ?? 0) || recent(a, b));
    case "random": {
      // Embaralha com semente (cada carregamento da página muda)
      let s = seed % 2147483647 || 1;
      const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  }
}

/** Os imóveis de uma seção da home, conforme a configuração */
export function pickForBlock<T extends Item>(list: T[], b: HomeBlock, views: Record<string, number> = {}, seed?: number): T[] {
  let base = list.filter(
    (p) => (b.purpose === "all" || p.purpose === b.purpose) && (!b.city || p.city.toLowerCase() === b.city.toLowerCase()),
  );
  if (b.source === "featured") base = base.filter((p) => p.featured);
  let ordered = sortItems(base, b.sort, views, seed);
  // Destaques sempre na frente quando a origem é "destaques e, se faltar, os demais"
  if (b.source === "featured_first" && b.sort !== "featured") {
    ordered = [...ordered.filter((p) => p.featured), ...ordered.filter((p) => !p.featured)];
  }
  if (!b.perHood) return ordered.slice(0, b.count);
  const perHood = new Map<string, number>();
  const out: T[] = [];
  for (const p of ordered) {
    const k = `${p.neighborhood}|${p.city}`.toLowerCase();
    const n = perHood.get(k) ?? 0;
    if (n >= b.perHood) continue;
    perHood.set(k, n + 1);
    out.push(p);
    if (out.length >= b.count) break;
  }
  return out;
}

/** Classes da grade conforme o número de colunas (celular: carrossel; tablet: 2) */
export function gridCols(n: Columns) {
  return n === 2 ? "sm:grid-cols-2" : n === 4 ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
}
