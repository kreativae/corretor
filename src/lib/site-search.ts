import type { PropertyFilters } from "@/components/crm/property-filters";

/** Busca do site público: parâmetros curtos na URL de /imoveis
 *  (?finalidade=venda&tipo=casa,apartamento&bairro=Moema&precoMax=800000&quartos=3). */
export type SiteSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const digits = (s: string) => s.replace(/\D/g, "");

/** Só os campos vindos da URL — o restante fica no padrão vazio. */
export function filtersFromSearch(sp: SiteSearchParams): Partial<PropertyFilters> {
  const fin = one(sp.finalidade);
  const quartos = Math.min(Number(digits(one(sp.quartos))) || 0, 4);
  const vagas = Math.min(Number(digits(one(sp.vagas))) || 0, 4);
  const suites = Math.min(Number(digits(one(sp.suites))) || 0, 4);
  return {
    q: one(sp.q).slice(0, 80),
    purpose: fin === "venda" || fin === "aluguel" ? fin : "all",
    types: list(sp.tipo),
    neighborhoods: list(sp.bairro),
    cities: list(sp.cidade),
    priceFrom: digits(one(sp.precoMin)),
    priceTo: digits(one(sp.precoMax)),
    areaFrom: digits(one(sp.areaMin)),
    areaTo: digits(one(sp.areaMax)),
    bedrooms: quartos,
    garage: vagas,
    suites,
    features: list(sp.caracteristica),
    // Rurais
    aptidoes: list(sp.aptidao),
    agua: list(sp.agua),
    energia: list(sp.energia),
    acesso: list(sp.acesso),
    benfeitorias: list(sp.benfeitoria),
    kmz: one(sp.kmz) === "1" ? "with" : "all",
  };
}

export function searchHref(p: {
  categoria?: "rurais" | "terrenos";
  finalidade?: "venda" | "aluguel" | "";
  tipo?: string;
  bairro?: string;
  cidade?: string;
  precoMin?: string;
  precoMax?: string;
  /** Área mínima/máxima (m² nos urbanos, alqueires nos rurais) */
  areaMin?: string;
  areaMax?: string;
  quartos?: number;
  suites?: number;
  vagas?: number;
  caracteristica?: string;
  aptidao?: string;
  agua?: string;
  energia?: string;
  acesso?: string;
  benfeitoria?: string;
  kmz?: "1";
  q?: string;
}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, String(v));
  const s = q.toString();
  return s ? `/imoveis?${s}` : "/imoveis";
}
