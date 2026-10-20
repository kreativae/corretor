import "server-only";
import { getDb } from "@/db";
import { regionGeo } from "@/db/schema";
import { cartoGeocode, getMapProvider, osmGeocode } from "@/lib/map-provider";
import { eq } from "drizzle-orm";

/**
 * Centro do círculo da região do imóvel no anúncio, a partir do endereço cadastrado:
 * - com coordenadas no cadastro, o centro é o próprio ponto;
 * - sem coordenadas, localiza rua + bairro + cidade (CARTO ou OpenStreetMap, guardado em cache);
 * - sem rua ou se ela não for encontrada, usa o centro do bairro.
 * O ponto não aparece no mapa: só o círculo.
 */
export async function areaCenter(
  p: { lat: number | null; lng: number | null; street: string; neighborhood: string; city: string; state: string },
): Promise<[number, number] | null> {
  if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return [p.lat, p.lng];
  if (!p.city) return null;
  const place = [p.neighborhood, p.city, p.state].map(norm).join("|");
  if (p.street.trim()) {
    const hit = await cachedGeocode(`end:${norm(p.street)}|${place}`, [p.street, p.neighborhood, p.city, p.state, "Brasil"]);
    if (hit) return hit;
  }
  return cachedGeocode(`bairro:${place}`, [p.neighborhood, p.city, p.state, "Brasil"]);
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function cachedGeocode(key: string, parts: string[]): Promise<[number, number] | null> {
  const db = await getDb();
  const [cached] = await db.select().from(regionGeo).where(eq(regionGeo.key, key)).catch(() => []);
  if (cached) return cached.lat != null && cached.lng != null ? [cached.lat, cached.lng] : null;

  const q = parts.filter(Boolean).join(", ");
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
