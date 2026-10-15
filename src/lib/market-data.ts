import "server-only";
import { db } from "@/db";
import { deals, marketSamples, properties, regionGeo } from "@/db/schema";
import { crmPropertyPath, isRuralType, normalizeRural, alqToM2 } from "@/lib/rural";
import { median, regionKey, unitValue, type MarketSample } from "@/lib/market";
import { desc, eq, inArray } from "drizzle-orm";

/** Área em m² de um imóvel (rurais: pela área total em alqueires, quando houver) */
function areaOf(p: { type: string; area: number; rural: unknown }) {
  if (isRuralType(p.type)) {
    const alq = normalizeRural(p.rural as never).totalAlq;
    if (alq && alq > 0) return alqToM2(alq);
  }
  return p.area;
}

/** Todas as amostras: anúncios da carteira, negócios fechados e amostras de mercado. */
export async function loadMarketSamples(): Promise<MarketSample[]> {
  const [props, closed, manual] = await Promise.all([
    db
      .select({
        id: properties.id,
        code: properties.code,
        type: properties.type,
        purpose: properties.purpose,
        status: properties.status,
        price: properties.price,
        area: properties.area,
        rural: properties.rural,
        neighborhood: properties.neighborhood,
        city: properties.city,
        state: properties.state,
        lat: properties.lat,
        lng: properties.lng,
        createdAt: properties.createdAt,
      })
      .from(properties),
    db
      .select({ propertyId: deals.propertyId, value: deals.value, updatedAt: deals.updatedAt })
      .from(deals)
      .where(eq(deals.stage, "fechado")),
    db.select().from(marketSamples).orderBy(desc(marketSamples.sampledAt)),
  ]);

  const byId = new Map(props.map((p) => [p.id, p]));
  const out: MarketSample[] = [];
  const closedIds = new Set<string>();

  // Negócio fechado vale mais que o preço pedido: substitui o anúncio do mesmo imóvel
  for (const d of closed) {
    const p = d.propertyId ? byId.get(d.propertyId) : null;
    if (!p) continue;
    closedIds.add(p.id);
    out.push({
      id: `deal-${p.id}-${d.updatedAt.getTime()}`,
      source: "fechado",
      type: p.type,
      purpose: p.purpose,
      rural: isRuralType(p.type),
      price: d.value > 0 ? d.value : p.price,
      area: areaOf(p),
      neighborhood: p.neighborhood,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      date: d.updatedAt.toISOString(),
      label: p.code,
      href: crmPropertyPath(p),
    });
  }
  for (const p of props) {
    if (closedIds.has(p.id) || p.status === "inativo") continue;
    out.push({
      id: `prop-${p.id}`,
      source: "anuncio",
      type: p.type,
      purpose: p.purpose,
      rural: isRuralType(p.type),
      price: p.price,
      area: areaOf(p),
      neighborhood: p.neighborhood,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      date: p.createdAt.toISOString(),
      label: p.code,
      href: crmPropertyPath(p),
    });
  }
  for (const m of manual) {
    out.push({
      id: m.id,
      source: "amostra",
      type: m.type,
      purpose: m.purpose,
      rural: isRuralType(m.type),
      price: m.price,
      area: m.area,
      neighborhood: m.neighborhood,
      city: m.city,
      state: m.state,
      lat: null,
      lng: null,
      date: m.sampledAt.toISOString(),
      label: m.source || "Amostra de mercado",
    });
  }
  return out.filter((s) => s.price > 0 && s.area > 0);
}

/** Centros já localizados (chave da região → lat/lng; null = não encontrado) */
export async function loadRegionGeo(keys: string[]) {
  if (!keys.length) return {};
  const rows = await db.select().from(regionGeo).where(inArray(regionGeo.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.lat != null && r.lng != null ? [r.lat, r.lng] : null])) as Record<
    string,
    [number, number] | null
  >;
}

/** Posição de um imóvel em relação à mediana da região (ficha do imóvel). */
export async function compareToRegion(p: {
  id: string;
  type: string;
  purpose: "venda" | "aluguel";
  price: number;
  area: number;
  rural: unknown;
  neighborhood: string;
  city: string;
  state: string;
}) {
  const rural = isRuralType(p.type);
  const area = areaOf(p);
  if (!(p.price > 0 && area > 0)) return null;
  const unit = rural ? "alq" : "m2";
  const key = regionKey(p, rural);
  const since = Date.now() - 2 * 365 * 86_400_000;
  const peers = (await loadMarketSamples()).filter(
    (s) =>
      s.rural === rural &&
      s.purpose === p.purpose &&
      !s.id.endsWith(p.id) &&
      !s.id.includes(`-${p.id}-`) &&
      Date.parse(s.date) >= since &&
      regionKey(s, rural) === key,
  );
  if (!peers.length) return null;
  const med = median(peers.map((s) => unitValue(s.price, s.area, unit)));
  const own = unitValue(p.price, area, unit);
  return {
    unit,
    own,
    median: med,
    diffPct: med > 0 ? ((own - med) / med) * 100 : 0,
    n: peers.length,
    region: rural ? p.city : p.neighborhood,
  } as const;
}
