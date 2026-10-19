import "server-only";
import { getDb } from "@/db";
import { regionGeo } from "@/db/schema";
import { cartoGeocode, getMapProvider, osmGeocode } from "@/lib/map-provider";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

/**
 * Centro do círculo da região do imóvel no anúncio. Nunca é o ponto exato:
 * - com coordenadas no cadastro, o centro é deslocado (sempre igual para o mesmo imóvel)
 *   até 40% do raio, para o imóvel não ficar no meio do círculo;
 * - sem coordenadas, usa o centro do bairro (CARTO ou OpenStreetMap, guardado em cache).
 */
export async function areaCenter(
  p: { id: string; lat: number | null; lng: number | null; neighborhood: string; city: string; state: string },
  radiusKm: number,
): Promise<[number, number] | null> {
  if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    const h = createHash("sha256").update(`area:${p.id}`).digest();
    const angle = (h.readUInt16BE(0) / 65535) * 2 * Math.PI;
    const dist = radiusKm * (0.15 + (h.readUInt16BE(2) / 65535) * 0.25);
    const lat = p.lat + (dist * Math.cos(angle)) / 111.32;
    const lng = p.lng + (dist * Math.sin(angle)) / (111.32 * Math.cos((p.lat * Math.PI) / 180));
    return [lat, lng];
  }
  return neighborhoodCenter(p.neighborhood, p.city, p.state);
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function neighborhoodCenter(neighborhood: string, city: string, state: string): Promise<[number, number] | null> {
  if (!city) return null;
  const key = `bairro:${norm(neighborhood)}|${norm(city)}|${norm(state)}`;
  const db = await getDb();
  const [cached] = await db.select().from(regionGeo).where(eq(regionGeo.key, key)).catch(() => []);
  if (cached) return cached.lat != null && cached.lng != null ? [cached.lat, cached.lng] : null;

  const q = [neighborhood, city, state, "Brasil"].filter(Boolean).join(", ");
  // Até 3 s: a página do anúncio não pode ficar esperando o serviço de mapas
  const timeout = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
  let hit: [number, number] | null = null;
  try {
    const cfg = await getMapProvider();
    if (cfg.cartoToken) hit = await timeout(cartoGeocode(cfg, q)).catch(() => null);
    if (!hit) hit = await timeout(osmGeocode(q));
  } catch {
    // Serviço fora do ar ou lento: não guarda, tenta de novo na próxima visita
    return null;
  }
  await db
    .insert(regionGeo)
    .values({ key, lat: hit?.[0] ?? null, lng: hit?.[1] ?? null })
    .onConflictDoNothing()
    .catch(() => undefined);
  return hit;
}
