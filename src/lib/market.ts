/** Valor do m² (e do alqueire) por região — cálculos puros, usados no servidor e no cliente. */
import { ALQUEIRE_HA, ALQUEIRE_M2 } from "@/lib/rural";

export type SampleSource = "anuncio" | "fechado" | "amostra";

export type MarketSample = {
  id: string;
  source: SampleSource;
  type: string;
  purpose: "venda" | "aluguel";
  rural: boolean;
  price: number;
  /** Área em m² (rurais também: alqueires × 24.200) */
  area: number;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  /** ISO */
  date: string;
  /** Código do imóvel ou origem da amostra */
  label: string;
  href?: string;
};

export type MarketUnit = "m2" | "alq" | "ha";

export const SOURCE_LABELS: Record<SampleSource, string> = {
  anuncio: "Anúncio",
  fechado: "Negócio fechado",
  amostra: "Amostra",
};

/** Abaixo disso a mediana é só um indício */
export const MIN_SAMPLES = 3;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Bairro + cidade (urbano) ou cidade + UF (rural) */
export function regionKey(s: Pick<MarketSample, "neighborhood" | "city" | "state">, rural: boolean) {
  return rural ? `${norm(s.city)}|${norm(s.state)}` : `${norm(s.neighborhood)}|${norm(s.city)}`;
}

/** Texto de busca no mapa para a região */
export function regionQuery(s: Pick<MarketSample, "neighborhood" | "city" | "state">, rural: boolean) {
  return rural ? `${s.city}, ${s.state}, Brasil` : `${s.neighborhood}, ${s.city}, ${s.state}, Brasil`;
}

/** R$ por unidade de área */
export function unitValue(price: number, areaM2: number, unit: MarketUnit) {
  if (!areaM2) return 0;
  const perM2 = price / areaM2;
  if (unit === "alq") return perM2 * ALQUEIRE_M2;
  if (unit === "ha") return perM2 * (ALQUEIRE_M2 / ALQUEIRE_HA);
  return perM2;
}

export const UNIT_SUFFIX: Record<MarketUnit, string> = { m2: "/m²", alq: "/alq", ha: "/ha" };

export function median(values: number[]) {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export type Region = {
  key: string;
  name: string;
  city: string;
  state: string;
  n: number;
  median: number;
  min: number;
  max: number;
  /** Variação da mediana: últimos 12 meses × os 12 anteriores (%), quando há dados nos dois */
  change: number | null;
  lat: number | null;
  lng: number | null;
  samples: (MarketSample & { value: number })[];
};

const YEAR = 365 * 86_400_000;

/**
 * Agrupa as amostras por região. `history` (mesmos filtros, sem o recorte de período)
 * serve para a variação em 12 meses.
 */
export function aggregate(
  samples: MarketSample[],
  opts: { rural: boolean; unit: MarketUnit; now: number; history?: MarketSample[] },
): Region[] {
  const groups = new Map<string, MarketSample[]>();
  for (const s of samples) {
    if (!(s.area > 0 && s.price > 0)) continue;
    const k = regionKey(s, opts.rural);
    const g = groups.get(k);
    if (g) g.push(s);
    else groups.set(k, [s]);
  }
  const hist = new Map<string, MarketSample[]>();
  for (const s of opts.history ?? samples) {
    if (!(s.area > 0 && s.price > 0)) continue;
    const k = regionKey(s, opts.rural);
    const g = hist.get(k);
    if (g) g.push(s);
    else hist.set(k, [s]);
  }

  const regions: Region[] = [];
  for (const [key, list] of groups) {
    const withValue = list
      .map((s) => ({ ...s, value: unitValue(s.price, s.area, opts.unit) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const values = withValue.map((s) => s.value);

    // Nome mais frequente (grafias variam: "Setor Bueno" × "setor bueno")
    const nameOf = (s: MarketSample) => (opts.rural ? s.city : s.neighborhood);
    const counts = new Map<string, number>();
    for (const s of list) counts.set(nameOf(s).trim(), (counts.get(nameOf(s).trim()) ?? 0) + 1);
    const name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    let change: number | null = null;
    const h = hist.get(key) ?? [];
    const recent = h.filter((s) => opts.now - Date.parse(s.date) <= YEAR).map((s) => unitValue(s.price, s.area, opts.unit));
    const before = h
      .filter((s) => {
        const age = opts.now - Date.parse(s.date);
        return age > YEAR && age <= 2 * YEAR;
      })
      .map((s) => unitValue(s.price, s.area, opts.unit));
    if (recent.length && before.length) {
      const b = median(before);
      if (b > 0) change = ((median(recent) - b) / b) * 100;
    }

    const geo = list.filter((s) => s.lat != null && s.lng != null);
    regions.push({
      key,
      name,
      city: list[0].city,
      state: list[0].state,
      n: list.length,
      median: median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      change,
      lat: geo.length ? geo.reduce((a, s) => a + (s.lat as number), 0) / geo.length : null,
      lng: geo.length ? geo.reduce((a, s) => a + (s.lng as number), 0) / geo.length : null,
      samples: withValue,
    });
  }
  return regions.sort((a, b) => b.median - a.median);
}

/** Faixa de cor (0 = mais barato … steps-1 = mais caro), pela posição no ranking */
export function binOf(rank: number, total: number, steps: number) {
  if (total <= 1) return Math.floor(steps / 2);
  return Math.min(steps - 1, Math.floor((rank / total) * steps));
}

/** Chave do cache de localização (prefixo separa bairros de municípios) */
export function geoKey(s: Pick<MarketSample, "neighborhood" | "city" | "state">, rural: boolean) {
  return `${rural ? "r" : "u"}:${regionKey(s, rural)}`;
}
