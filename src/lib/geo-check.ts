import "server-only";
import { getDb } from "@/db";
import { regionGeo } from "@/db/schema";
import { cartoGeocode, getMapProvider, osmGeocode } from "@/lib/map-provider";
import { eq } from "drizzle-orm";

/**
 * Localização conferida: bairros com o mesmo nome existem em várias cidades (ex.: "Jardim do Sol"
 * em Londrina e em Goiânia), e o serviço de mapas às vezes devolve o de outra cidade. Aqui o
 * resultado só vale se ficar perto do centro da cidade informada; senão, usa o centro da cidade.
 */

/** Distância máxima do centro da cidade para aceitar um bairro/endereço */
const MAX_KM = 40;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function distanceKm(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Até 3 s por consulta: páginas não podem ficar esperando o serviço de mapas
const timeout = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);

/** Consulta CARTO (com token) e OpenStreetMap; devolve todos os pontos achados */
async function lookup(q: string): Promise<[number, number][]> {
  const out: [number, number][] = [];
  const cfg = await getMapProvider();
  if (cfg.cartoToken) {
    const hit = await timeout(cartoGeocode(cfg, q)).catch(() => null);
    if (hit) out.push(hit);
  }
  const osm = await timeout(osmGeocode(q)).catch(() => null);
  if (osm) out.push(osm);
  return out;
}

/** Centro da cidade (guardado em cache) */
export async function cityCenter(city: string, state: string): Promise<[number, number] | null> {
  if (!city.trim()) return null;
  const key = `cidade:${norm(city)}|${norm(state)}`;
  const db = await getDb();
  const [cached] = await db.select().from(regionGeo).where(eq(regionGeo.key, key)).catch(() => []);
  if (cached) return cached.lat != null && cached.lng != null ? [cached.lat, cached.lng] : null;
  const [hit] = await lookup([city, state, "Brasil"].filter(Boolean).join(", "));
  if (!hit) return null; // não guarda: tenta de novo depois
  await db.insert(regionGeo).values({ key, lat: hit[0], lng: hit[1] }).onConflictDoNothing().catch(() => undefined);
  return hit;
}

/** O ponto fica na cidade? (sem centro conhecido, aceita) */
export function insideCity(point: [number, number], center: [number, number] | null) {
  return !center || distanceKm(point, center) <= MAX_KM;
}

/** Localiza o texto e devolve o primeiro ponto dentro da cidade; nenhum = centro da cidade (ou null) */
export async function geocodeInCity(
  q: string,
  city: string,
  state: string,
  fallbackToCenter = true,
): Promise<[number, number] | null> {
  const center = await cityCenter(city, state);
  const hits = await lookup(q);
  return hits.find((h) => insideCity(h, center)) ?? (fallbackToCenter ? center : null);
}
